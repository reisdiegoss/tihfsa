import { useState, useEffect, useMemo } from "react";
import {
  FileText, Cpu, HardDrive, Wrench, Clock, CheckCircle2,
  AlertTriangle, AlertCircle, Info, Printer, X, RefreshCw,
  User, Building, Tag, ExternalLink, Activity, ArrowUpRight,
  TrendingUp, Calendar, Zap, Layers, BarChart2, Search, ArrowUpDown
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine
} from "recharts";
import api from "../../api/client";

export default function MachineHistoryModal({ isOpen, onClose, machine, initialTab = "metrics" }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'metrics' | 'processes' | 'report' | 'tickets'
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);

  // Estados do Gráfico Temporal & Degradação
  const [chartRange, setChartRange] = useState("24h"); // '24h', '7d', '30d', '90d', '1y', 'all'
  const [chartLoading, setChartLoading] = useState(false);
  const [chartData, setChartData] = useState(null);

  // Estados dos Processos Ativos (Task Manager)
  const [procSearch, setProcSearch] = useState("");
  const [procSort, setProcSort] = useState("cpu"); // 'cpu' | 'ram' | 'disk'

  const fetchHistory = () => {
    if (!machine) return;
    setLoading(true);
    api.get(`/monitoring/agent/machines/${machine.id}/history?limit_metrics=100`)
      .then((res) => {
        setHistoryData(res.data);
      })
      .catch((err) => {
        console.error("Erro ao carregar histórico do equipamento:", err);
      })
      .finally(() => setLoading(false));
  };

  const fetchChartData = (range) => {
    if (!machine) return;
    setChartLoading(true);
    api.get(`/monitoring/agent/machines/${machine.id}/metrics-chart?time_range=${range}`)
      .then((res) => {
        setChartData(res.data);
      })
      .catch((err) => {
        console.error("Erro ao carregar gráfico temporal:", err);
      })
      .finally(() => setChartLoading(false));
  };

  useEffect(() => {
    if (isOpen && machine) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      fetchHistory();
      fetchChartData(chartRange);
    }
  }, [isOpen, machine, initialTab]);

  const handleRangeChange = (range) => {
    setChartRange(range);
    fetchChartData(range);
  };

  if (!isOpen || !machine) return null;

  const handlePrint = () => {
    window.print();
  };

  const tickets = historyData?.tickets || [];
  const metrics = historyData?.metrics_history || [];
  const recommendations = historyData?.hardware_recommendations || [];
  const degradationEvents = chartData?.degradation_events || [];
  const chartPoints = chartData?.data_points || [];
  const summary = chartData?.summary || {};
  const rawProcesses = historyData?.top_processes || machine?.top_processes || [];

  // Filtragem e ordenação dos processos ativos
  const filteredProcesses = useMemo(() => {
    let list = [...rawProcesses];
    if (procSearch.trim()) {
      const q = procSearch.toLowerCase();
      list = list.filter((p) =>
        (p.name || "").toLowerCase().includes(q) ||
        String(p.pid || "").includes(q)
      );
    }
    list.sort((a, b) => {
      if (procSort === "ram") return (b.ram_mb || 0) - (a.ram_mb || 0);
      if (procSort === "disk") return (b.disk_kbps || 0) - (a.disk_kbps || 0);
      return (b.cpu_pct || 0) - (a.cpu_pct || 0);
    });
    return list;
  }, [rawProcesses, procSearch, procSort]);

  // Top vilões de consumo para cards de destaque
  const topCpuProc = useMemo(() => {
    if (!rawProcesses.length) return null;
    return [...rawProcesses].sort((a, b) => (b.cpu_pct || 0) - (a.cpu_pct || 0))[0];
  }, [rawProcesses]);

  const topRamProc = useMemo(() => {
    if (!rawProcesses.length) return null;
    return [...rawProcesses].sort((a, b) => (b.ram_mb || 0) - (a.ram_mb || 0))[0];
  }, [rawProcesses]);

  const topDiskProc = useMemo(() => {
    if (!rawProcesses.length) return null;
    return [...rawProcesses].sort((a, b) => (b.disk_kbps || 0) - (a.disk_kbps || 0))[0];
  }, [rawProcesses]);

  const currentDiskActive = historyData?.disk_active_pct ?? machine?.disk_active_pct ?? 0;

  // Custom Tooltip para o Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs space-y-1.5 backdrop-blur-xs">
          <p className="font-black text-slate-300 border-b border-slate-700 pb-1 flex items-center justify-between gap-4">
            <span>Momento: {label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
              data.status === "warning" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"
            }`}>
              {data.status}
            </span>
          </p>
          <div className="space-y-1 font-mono text-[11px]">
            <p className="text-blue-400 flex items-center justify-between gap-4">
              <span>CPU Média: <strong>{data.cpu_pct}%</strong></span>
              <span className="text-[10px] text-slate-400">(Pico: {data.cpu_peak}%)</span>
            </p>
            <p className="text-purple-400 flex items-center justify-between gap-4">
              <span>RAM Média: <strong>{data.ram_pct}%</strong></span>
              <span className="text-[10px] text-slate-400">(Pico: {data.ram_peak}%)</span>
            </p>
            {data.disk_active_pct !== undefined && data.disk_active_pct !== null && (
              <p className="text-amber-400 flex items-center justify-between gap-4">
                <span>Atividade Disco: <strong>{data.disk_active_pct}%</strong></span>
                <span className="text-[10px] text-slate-400">Tempo Ativo</span>
              </p>
            )}
            <p className="text-pink-400 flex items-center justify-between gap-4">
              <span>Disco C: <strong>{data.disk_pct}%</strong></span>
              {data.disk_free_gb && <span className="text-[10px] text-slate-400">({data.disk_free_gb} GB livres)</span>}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[94vh] flex flex-col print:max-h-none print:h-auto print:border-none print:shadow-none print:p-6 print:rounded-none">
        
        {/* ─── HEADER MODAL / RELATÓRIO ─── */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs">
              <Activity size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black text-slate-900">
                  {historyData?.hostname || machine.hostname}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  {historyData?.device_type || machine.device_type || "Desktop"}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                  machine.is_online
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${machine.is_online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                  {machine.is_online ? "Conectada" : "Offline"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {machine.brand && machine.brand !== "Desconhecido" ? `${machine.brand} • ` : ""}
                {machine.model && machine.model !== "Desconhecido" ? `${machine.model} • ` : ""}
                IP: <strong className="text-slate-700 font-mono">{machine.ip_address}</strong>
                {machine.serial_number && machine.serial_number !== "Desconhecido" ? ` • S/N: ${machine.serial_number}` : ""}
                {historyData?.department_name ? ` • 🏢 ${historyData.department_name}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              title="Imprimir laudo técnico ou salvar em PDF"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── ABAS DE NAVEGAÇÃO (Ocultas na Impressão) ─── */}
        <div className="flex items-center gap-2 border-b border-slate-100 py-3 shrink-0 print:hidden overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("metrics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "metrics"
                ? "bg-indigo-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <BarChart2 size={15} />
            <span>Gráficos de Consumo & Degradação</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("processes")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "processes"
                ? "bg-indigo-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Zap size={15} />
            <span>Processos Ativos (Task Manager) {rawProcesses.length > 0 ? `(${rawProcesses.length})` : ""}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("report")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "report"
                ? "bg-indigo-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText size={15} />
            <span>Laudo & Diagnóstico de Upgrade</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tickets")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
              activeTab === "tickets"
                ? "bg-indigo-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Wrench size={15} />
            <span>Manutenções & Chamados ({tickets.length})</span>
          </button>
        </div>

        {/* ─── CONTEÚDO SCROLLÁVEL ─── */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 print:overflow-visible">
          {loading ? (
            <div className="p-16 text-center text-slate-400 font-semibold space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-indigo-600" />
              <p className="text-xs">Processando histórico e telemetria temporal do equipamento...</p>
            </div>
          ) : (
            <>
              {/* ──────────────────────────────────────────────────────────
                  ABA 1: GRÁFICOS DE CONSUMO & ANÁLISE DE DEGRADAÇÃO
                  ────────────────────────────────────────────────────────── */}
              {activeTab === "metrics" && (
                <div className="space-y-5">
                  {/* Barra de Filtro de Período (24h, 7d, 30d, 90d, 1y, all) */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider pl-1">
                        Intervalo Temporal:
                      </span>
                    </div>

                    <div className="inline-flex p-1 bg-slate-200/70 rounded-xl gap-1 flex-wrap">
                      {[
                        { key: "24h", label: "24 Horas" },
                        { key: "7d", label: "7 Dias" },
                        { key: "30d", label: "30 Dias (Mês)" },
                        { key: "90d", label: "3 Meses" },
                        { key: "1y", label: "1 Ano" },
                        { key: "all", label: "Tudo" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleRangeChange(item.key)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            chartRange === item.key
                              ? "bg-white text-indigo-700 font-black shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ─── BANNER DE DETECÇÃO DE DEGRADAÇÃO ("QUANDO COMEÇOU A FICAR RUIM") ─── */}
                  {degradationEvents.length > 0 ? (
                    <div className="p-4 bg-gradient-to-r from-red-50 via-amber-50 to-red-50 border border-red-200 rounded-2xl space-y-2 shadow-2xs">
                      <div className="flex items-center gap-2 text-red-800">
                        <AlertTriangle size={18} className="text-red-600 shrink-0 animate-bounce" />
                        <h4 className="font-black text-xs uppercase tracking-wide">
                          Identificação de Degradação de Desempenho no Período
                        </h4>
                      </div>
                      <div className="space-y-1.5">
                        {degradationEvents.map((evt, idx) => (
                          <div key={idx} className="p-3 bg-white/90 rounded-xl border border-red-100 flex items-start gap-3 text-xs">
                            <span className="px-2 py-0.5 rounded font-black text-[10px] bg-red-100 text-red-800 shrink-0">
                              {evt.metric}
                            </span>
                            <div className="flex-1">
                              <p className="font-bold text-slate-800 leading-relaxed">{evt.message}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Início do declínio observado em: <strong className="text-slate-900 font-mono">{evt.detected_at}</strong> • Variação: {evt.initial_value} ➔ <strong className="text-red-700">{evt.current_value}</strong>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-900 font-semibold">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      <span>
                        <strong>Comportamento Saudável:</strong> Não foram detectadas quedas anômalas ou rompimento persistente dos limiares de segurança no período de {chartRange}.
                      </span>
                    </div>
                  )}

                  {/* ─── GRÁFICO INTERATIVO (RECHARTS) ─── */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-indigo-600" />
                        <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">
                          Evolução Temporal de CPU, Memória RAM e Disco (Check-in a cada 15 min)
                        </h4>
                      </div>
                      {chartLoading && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                          <RefreshCw size={12} className="animate-spin" /> Atualizando gráfico...
                        </span>
                      )}
                    </div>

                    <div className="h-72 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                            </linearGradient>
                            <linearGradient id="colorDiskActive" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>

                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} />
                          <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} unit="%" tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />

                          {/* Linhas de Corte Operacional */}
                          <ReferenceLine
                            y={80}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{ value: "Alerta 80%", position: "insideTopRight", fill: "#f59e0b", fontSize: 10, fontWeight: "bold" }}
                          />
                          <ReferenceLine
                            y={90}
                            stroke="#ef4444"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{ value: "Crítico 90%", position: "insideTopRight", fill: "#ef4444", fontSize: 10, fontWeight: "bold" }}
                          />

                          <Area
                            type="monotone"
                            dataKey="cpu_pct"
                            name="Processador CPU (%)"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorCpu)"
                          />
                          <Area
                            type="monotone"
                            dataKey="ram_pct"
                            name="Memória RAM (%)"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorRam)"
                          />
                          <Area
                            type="monotone"
                            dataKey="disk_active_pct"
                            name="Atividade de Disco (%)"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorDiskActive)"
                          />
                          <Area
                            type="monotone"
                            dataKey="disk_pct"
                            name="Disco C: Ocupação (%)"
                            stroke="#ec4899"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorDisk)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* ─── CARDS DE KPI E RESUMO ESTATÍSTICO DO PERÍODO ─── */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">CPU (Processador)</span>
                      <p className="text-2xl font-black text-blue-950">{summary.current_cpu ?? 0}%</p>
                      <div className="flex justify-between text-[10px] text-blue-800 font-mono">
                        <span>Média: {summary.avg_cpu ?? 0}%</span>
                        <span className="font-bold text-red-600">Pico: {summary.peak_cpu ?? 0}%</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">Memória RAM</span>
                      <p className="text-2xl font-black text-purple-950">{summary.current_ram ?? 0}%</p>
                      <div className="flex justify-between text-[10px] text-purple-800 font-mono">
                        <span>Média: {summary.avg_ram ?? 0}%</span>
                        <span className="font-bold text-red-600">Pico: {summary.peak_ram ?? 0}%</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">Atividade Disco</span>
                      <p className="text-2xl font-black text-amber-950">{summary.current_disk_active ?? currentDiskActive}%</p>
                      <div className="flex justify-between text-[10px] text-amber-800 font-mono">
                        <span>Média: {summary.avg_disk_active ?? 0}%</span>
                        <span className={`font-bold ${(summary.peak_disk_active ?? 0) >= 90 ? "text-red-600" : ""}`}>
                          Pico: {summary.peak_disk_active ?? 0}%
                        </span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-pink-50/60 border border-pink-200/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black uppercase text-pink-700 tracking-wider">Disco C: Ocupação</span>
                      <p className="text-2xl font-black text-pink-950">{summary.current_disk ?? 0}%</p>
                      <div className="flex justify-between text-[10px] text-pink-800 font-mono">
                        <span>Média: {summary.avg_disk ?? 0}%</span>
                        <span>Pico: {summary.peak_disk ?? 0}%</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1 col-span-2 lg:col-span-1">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Amostras</span>
                      <p className="text-2xl font-black text-slate-800">{summary.total_samples ?? metrics.length}</p>
                      <p className="text-[10px] text-slate-400">Medições (15 min)</p>
                    </div>
                  </div>

                  {/* ─── TABELA CRONOLÓGICA DE AMOSTRAS ─── */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                      Registros de Telemetria no Período ({chartPoints.length} medições agregadas)
                    </h5>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="px-3.5 py-2">Data & Horário</th>
                            <th className="px-3 py-2">CPU Média</th>
                            <th className="px-3 py-2">Pico CPU</th>
                            <th className="px-3 py-2">RAM Média</th>
                            <th className="px-3 py-2">Pico RAM</th>
                            <th className="px-3 py-2">Disco C:</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700 font-mono text-[11px]">
                          {chartPoints.map((pt, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-3.5 py-2 font-bold text-slate-900">{pt.label}</td>
                              <td className="px-3 py-2 text-blue-700">{pt.cpu_pct}%</td>
                              <td className={`px-3 py-2 ${pt.cpu_peak >= 90 ? "text-red-600 font-black" : "text-slate-500"}`}>{pt.cpu_peak}%</td>
                              <td className="px-3 py-2 text-purple-700">{pt.ram_pct}%</td>
                              <td className={`px-3 py-2 ${pt.ram_peak >= 85 ? "text-red-600 font-black" : "text-slate-500"}`}>{pt.ram_peak}%</td>
                              <td className="px-3 py-2 text-pink-700">{pt.disk_pct}%</td>
                              <td className="px-3 py-2 font-sans">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                  pt.status === "warning" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                }`}>
                                  {pt.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  ABA 2: PROCESSOS ATIVOS (TASK MANAGER EM TEMPO REAL)
                  ────────────────────────────────────────────────────────── */}
              {activeTab === "processes" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Topo da Aba: Informação e Botão de Refresh */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Zap size={16} className="text-amber-500 shrink-0" />
                        <h4 className="text-sm font-black text-slate-900">
                          Gerenciador de Processos Ativos (Task Manager)
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-700">
                          Sentinel Agent
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Top processos em execução coletados periodicamente da estação para auditoria de gargalos de CPU, memória e saturação de disco (100% I/O).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={fetchHistory}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 text-xs font-bold transition-all shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
                      title="Recarregar telemetria e processos"
                    >
                      <RefreshCw size={13} className={loading ? "animate-spin text-indigo-600" : ""} />
                      <span>Atualizar Processos</span>
                    </button>
                  </div>

                  {/* Banner de Alerta Crítico se Disco estiver em 100% de atividade */}
                  {currentDiskActive >= 90 && (
                    <div className="p-4 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-red-500/10 border border-red-300 rounded-2xl flex items-start gap-3 text-red-950">
                      <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-1">
                        <h5 className="font-black text-xs uppercase tracking-wide text-red-800">
                          🔥 Alerta Severo de Disco 100%: Atividade Instantânea em {currentDiskActive}%
                        </h5>
                        <p className="text-xs leading-relaxed text-red-900 font-medium">
                          O subsistema de armazenamento da máquina está sofrendo saturação contínua de E/S.
                          {topDiskProc ? (
                            <> O processo <strong>{topDiskProc.name}</strong> (PID: <span className="font-mono">{topDiskProc.pid}</span>) é o principal responsável, movimentando cerca de <strong>{topDiskProc.disk_kbps >= 1024 ? `${(topDiskProc.disk_kbps / 1024).toFixed(1)} MB/s` : `${topDiskProc.disk_kbps} KB/s`}</strong>.</>
                          ) : " Verifique abaixo os processos com alta taxa de KB/s."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Cards de Vilões de Consumo (Top 3) */}
                  {rawProcesses.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Top CPU */}
                      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider flex items-center gap-1">
                            <Cpu size={12} /> Maior Carga de CPU
                          </span>
                          <span className="text-xs font-black text-blue-800 font-mono">
                            {topCpuProc?.cpu_pct ?? 0}%
                          </span>
                        </div>
                        <p className="text-sm font-black text-slate-900 truncate" title={topCpuProc?.name}>
                          {topCpuProc?.name || "—"}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          PID: {topCpuProc?.pid || "—"} • {topCpuProc?.ram_mb ?? 0} MB RAM
                        </p>
                      </div>

                      {/* Top RAM */}
                      <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1">
                            <Layers size={12} /> Maior Consumo de RAM
                          </span>
                          <span className="text-xs font-black text-purple-800 font-mono">
                            {topRamProc ? (topRamProc.ram_mb >= 1024 ? `${(topRamProc.ram_mb / 1024).toFixed(1)} GB` : `${topRamProc.ram_mb} MB`) : "—"}
                          </span>
                        </div>
                        <p className="text-sm font-black text-slate-900 truncate" title={topRamProc?.name}>
                          {topRamProc?.name || "—"}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          PID: {topRamProc?.pid || "—"} • {topRamProc?.cpu_pct ?? 0}% CPU
                        </p>
                      </div>

                      {/* Top Disk */}
                      <div className={`p-3.5 rounded-2xl space-y-1.5 border transition-all ${
                        currentDiskActive >= 90
                          ? "bg-red-50/80 border-red-300 ring-1 ring-red-200"
                          : "bg-amber-50/70 border-amber-200"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                            currentDiskActive >= 90 ? "text-red-700" : "text-amber-700"
                          }`}>
                            <HardDrive size={12} /> Maior E/S de Disco (I/O)
                          </span>
                          <span className={`text-xs font-black font-mono ${
                            currentDiskActive >= 90 ? "text-red-700" : "text-amber-800"
                          }`}>
                            {topDiskProc ? (topDiskProc.disk_kbps >= 1024 ? `${(topDiskProc.disk_kbps / 1024).toFixed(1)} MB/s` : `${topDiskProc.disk_kbps} KB/s`) : "—"}
                          </span>
                        </div>
                        <p className="text-sm font-black text-slate-900 truncate" title={topDiskProc?.name}>
                          {topDiskProc?.name || "—"}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          PID: {topDiskProc?.pid || "—"} • Atividade: {currentDiskActive}%
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Barra de Filtros e Ordenação de Processos */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="relative flex-1 max-w-sm">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={procSearch}
                        onChange={(e) => setProcSearch(e.target.value)}
                        placeholder="Buscar processo por nome ou PID..."
                        className="w-full pl-9 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                      />
                      {procSearch && (
                        <button
                          type="button"
                          onClick={() => setProcSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mr-1">
                        Ordenar por:
                      </span>
                      <button
                        type="button"
                        onClick={() => setProcSort("cpu")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          procSort === "cpu"
                            ? "bg-blue-600 text-white shadow-xs font-black"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        🔥 CPU (%)
                      </button>
                      <button
                        type="button"
                        onClick={() => setProcSort("ram")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          procSort === "ram"
                            ? "bg-purple-600 text-white shadow-xs font-black"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        🧠 Memória RAM
                      </button>
                      <button
                        type="button"
                        onClick={() => setProcSort("disk")}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          procSort === "disk"
                            ? "bg-amber-600 text-white shadow-xs font-black"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        💾 Disco (E/S)
                      </button>
                    </div>
                  </div>

                  {/* Tabela de Processos */}
                  {rawProcesses.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                        <Zap size={24} />
                      </div>
                      <div>
                        <h5 className="font-black text-slate-800 text-sm">Nenhuma amostra de processos coletada ainda</h5>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                          O TIHFSA Sentinel Agent atualizado reporta automaticamente os processos mais pesados de 15 em 15 minutos (ou ao executar o script localmente). A lista aparecerá aqui no próximo check-in.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchHistory}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        Verificar Agora
                      </button>
                    </div>
                  ) : filteredProcesses.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-semibold">
                        Nenhum processo corresponde à busca "<strong>{procSearch}</strong>".
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10 backdrop-blur-xs">
                            <tr>
                              <th className="px-4 py-3">Processo (Imagem)</th>
                              <th className="px-3 py-3">PID</th>
                              <th className="px-3 py-3 w-44">Uso de CPU</th>
                              <th className="px-3 py-3 w-40">Memória RAM</th>
                              <th className="px-3 py-3 w-36">E/S de Disco</th>
                              <th className="px-3 py-3 text-right">Impacto</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                            {filteredProcesses.map((p, idx) => {
                              const cpuPct = Number(p.cpu_pct || 0);
                              const ramMb = Number(p.ram_mb || 0);
                              const diskKbps = Number(p.disk_kbps || 0);

                              const isHighCpu = cpuPct >= 40;
                              const isHighRam = ramMb >= 1500;
                              const isHighDisk = diskKbps >= 5000;
                              const isCritical = isHighCpu || isHighDisk || (isHighRam && cpuPct >= 20);

                              const diskFormatted = diskKbps >= 1024
                                ? `${(diskKbps / 1024).toFixed(1)} MB/s`
                                : `${Math.round(diskKbps)} KB/s`;

                              const ramFormatted = ramMb >= 1024
                                ? `${(ramMb / 1024).toFixed(1)} GB`
                                : `${Math.round(ramMb)} MB`;

                              return (
                                <tr
                                  key={`${p.pid}-${idx}`}
                                  className={`transition-colors ${
                                    isCritical
                                      ? "bg-red-50/40 hover:bg-red-50/70"
                                      : isHighCpu || isHighDisk || isHighRam
                                      ? "bg-amber-50/30 hover:bg-amber-50/60"
                                      : "hover:bg-slate-50/80"
                                  }`}
                                >
                                  {/* Nome do Processo */}
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                        isCritical
                                          ? "bg-red-100 text-red-700"
                                          : isHighCpu || isHighDisk
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-slate-100 text-slate-600"
                                      }`}>
                                        <Zap size={12} />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-bold text-slate-900 truncate font-mono text-xs" title={p.name}>
                                          {p.name}
                                        </p>
                                      </div>
                                    </div>
                                  </td>

                                  {/* PID */}
                                  <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">
                                    {p.pid || "—"}
                                  </td>

                                  {/* CPU */}
                                  <td className="px-3 py-2.5">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[11px] font-mono">
                                        <span className={`font-bold ${cpuPct >= 50 ? "text-red-600" : cpuPct >= 20 ? "text-amber-600" : "text-blue-700"}`}>
                                          {cpuPct}%
                                        </span>
                                      </div>
                                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            cpuPct >= 50 ? "bg-red-500" : cpuPct >= 20 ? "bg-amber-500" : "bg-blue-500"
                                          }`}
                                          style={{ width: `${Math.min(100, Math.max(3, cpuPct))}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>

                                  {/* RAM */}
                                  <td className="px-3 py-2.5">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between text-[11px] font-mono">
                                        <span className={`font-bold ${ramMb >= 1500 ? "text-red-600" : ramMb >= 800 ? "text-purple-700" : "text-slate-700"}`}>
                                          {ramFormatted}
                                        </span>
                                      </div>
                                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            ramMb >= 1500 ? "bg-red-500" : ramMb >= 800 ? "bg-purple-500" : "bg-slate-400"
                                          }`}
                                          style={{ width: `${Math.min(100, Math.max(3, (ramMb / 4096) * 100))}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>

                                  {/* Disco E/S */}
                                  <td className="px-3 py-2.5 font-mono text-[11px]">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${
                                      diskKbps >= 5000
                                        ? "bg-red-100 text-red-800"
                                        : diskKbps >= 1024
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}>
                                      <HardDrive size={10} />
                                      {diskFormatted}
                                    </span>
                                  </td>

                                  {/* Impacto */}
                                  <td className="px-3 py-2.5 text-right">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                      isCritical
                                        ? "bg-red-100 text-red-700 border border-red-200"
                                        : isHighCpu || isHighDisk || isHighRam
                                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                                        : "bg-slate-100 text-slate-600"
                                    }`}>
                                      {isCritical ? "Crítico" : isHighCpu || isHighDisk || isHighRam ? "Elevado" : "Normal"}
                                    </span>
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
              )}

              {/* ──────────────────────────────────────────────────────────
                  ABA 3: RELATÓRIO TÉCNICO & DIAGNÓSTICO DE UPGRADE
                  ────────────────────────────────────────────────────────── */}
              {(activeTab === "report" || window.matchMedia("print").matches) && (
                <div className="space-y-6 print:space-y-4">
                  {/* Cabeçalho Formal para Impressão */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                        Hotel Fasano Salvador • Diretoria de TI & Telecomunicações
                      </span>
                      <h2 className="text-base font-black text-slate-900">
                        Laudo de Avaliação de Desempenho & Planejamento de Upgrade
                      </h2>
                      <p className="text-xs text-slate-500">
                        Documento oficial emitido em {new Date().toLocaleString("pt-BR")}.
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-bold text-slate-800">
                        Responsável: {historyData?.assigned_user_name || "Equipamento Compartilhado"}
                      </p>
                      <p className="text-slate-500">
                        Setor: <strong>{historyData?.department_name || "Geral / TI"}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Resumo da Degradação Identificada no Laudo */}
                  {degradationEvents.length > 0 && (
                    <div className="p-4 bg-red-50/70 border border-red-300 rounded-2xl space-y-1.5">
                      <div className="flex items-center gap-1.5 text-red-800">
                        <AlertTriangle size={15} />
                        <h5 className="font-black text-xs uppercase tracking-wider">
                          Ponto de Inflexão e Degradação Histórica Identificada
                        </h5>
                      </div>
                      {degradationEvents.map((evt, idx) => (
                        <p key={idx} className="text-xs text-red-950 font-medium">
                          • <strong>{evt.metric}:</strong> {evt.message} (Início detectado: <strong>{evt.detected_at}</strong>).
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Diagnósticos Automatizados & Recomendações de Peças */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <AlertCircle size={15} className="text-indigo-600" /> Diagnósticos Automatizados de Hardware
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {recommendations.map((rec, idx) => {
                        const isDanger = rec.type === "danger";
                        const isWarning = rec.type === "warning";
                        const isSuccess = rec.type === "success";

                        return (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl border transition-all ${
                              isDanger
                                ? "bg-red-50/70 border-red-300 text-red-950"
                                : isWarning
                                ? "bg-amber-50/70 border-amber-300 text-amber-950"
                                : isSuccess
                                ? "bg-emerald-50/70 border-emerald-300 text-emerald-950"
                                : "bg-blue-50/70 border-blue-300 text-blue-950"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {isDanger ? (
                                <AlertCircle size={16} className="text-red-600 shrink-0" />
                              ) : isWarning ? (
                                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                              ) : isSuccess ? (
                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                              ) : (
                                <Info size={16} className="text-blue-600 shrink-0" />
                              )}
                              <h5 className="font-black text-xs">{rec.title}</h5>
                            </div>
                            <p className="text-xs font-medium leading-relaxed opacity-90">{rec.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Plano de Ação & Sugestão de Aquisição */}
                  <div className="p-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl space-y-3 shadow-md print:bg-white print:text-slate-900 print:border print:border-slate-300">
                    <div className="flex items-center gap-2">
                      <Cpu size={18} className="text-indigo-400 print:text-indigo-600" />
                      <h4 className="text-sm font-black text-white print:text-slate-900">
                        Parecer Técnico para Aquisição de Peças & Melhoria de Desempenho
                      </h4>
                    </div>
                    <div className="text-xs text-slate-300 print:text-slate-700 space-y-2 leading-relaxed">
                      {(summary.avg_ram >= 80 || (machine.ram_total_mb && machine.ram_total_mb <= 8192 && summary.avg_ram >= 70)) ? (
                        <p>
                          • <strong>Upgrade de Memória RAM Prioritário:</strong> O consumo de RAM mantém-se em patamares elevados ({summary.avg_ram ?? 0}% médio, com pico de {summary.peak_ram ?? 0}%). Recomenda-se a aquisição de módulo adicional para totalizar 16 GB ou 32 GB, eliminando lentidões operacionais.
                        </p>
                      ) : (
                        <p>
                          • <strong>Memória RAM Estável:</strong> A capacidade de {machine.ram_total_mb ? Math.round(machine.ram_total_mb / 1024) : 8} GB atende satisfatoriamente a demanda atual.
                        </p>
                      )}

                      {machine.disk_metrics && machine.disk_metrics.some((d) => d.used_pct >= 85) ? (
                        <p>
                          • <strong>Armazenamento em Alerta:</strong> A unidade de disco principal opera com espaço residual reduzido (&gt;85% de uso). Recomendada aquisição de SSD de 512 GB ou 1 TB para prevenção de travamentos e integridade de dados.
                        </p>
                      ) : (
                        <p>
                          • <strong>Armazenamento Adequado:</strong> Capacidade de disco suficiente para as rotinas corporativas.
                        </p>
                      )}

                      {tickets.length >= 3 && (
                        <p>
                          • <strong>Atenção à Recorrência de Incidentes:</strong> Equipamento acumula {tickets.length} chamados de suporte técnico. Caso o custo de manutenção continue elevado, sugerir substituição programada.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  ABA 3: MANUTENÇÕES & CHAMADOS DO EQUIPAMENTO
                  ────────────────────────────────────────────────────────── */}
              {activeTab === "tickets" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Histórico de Chamados e Manutenções</h4>
                      <p className="text-xs text-slate-500">Incidentes vinculados ao ativo ou ao hostname da máquina</p>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      Total: <strong>{tickets.length}</strong> chamados
                    </span>
                  </div>

                  {tickets.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
                      <h5 className="font-black text-slate-800 text-sm">Nenhum chamado registrado</h5>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Este equipamento ainda não precisou de manutenções corretivas no helpdesk.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3">Chamado</th>
                            <th className="px-3 py-3">Status</th>
                            <th className="px-3 py-3">Prioridade</th>
                            <th className="px-3 py-3">Solicitante</th>
                            <th className="px-3 py-3">Técnico</th>
                            <th className="px-3 py-3">Abertura</th>
                            <th className="px-3 py-3">Conclusão</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {tickets.map((t) => {
                            const isClosed = t.status === "Fechado";
                            const isPending = t.status === "Aguardando Validação";
                            const isInProgress = t.status === "Em Andamento";

                            return (
                              <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-900">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-indigo-600 font-black">#{t.id}</span>
                                    <span className="truncate max-w-xs">{t.title}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                    isClosed
                                      ? "bg-emerald-100 text-emerald-800"
                                      : isPending
                                      ? "bg-purple-100 text-purple-800"
                                      : isInProgress
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}>
                                    {t.status}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <span className={`text-[10px] font-bold ${
                                    t.priority === "Crítica" ? "text-red-600" : t.priority === "Alta" ? "text-amber-600" : "text-slate-500"
                                  }`}>
                                    {t.priority}
                                  </span>
                                </td>
                                <td className="px-3 py-3 text-slate-600 truncate max-w-[120px]">
                                  {t.requester_name || "—"}
                                </td>
                                <td className="px-3 py-3 text-slate-600 truncate max-w-[120px]">
                                  {t.technician_name || "—"}
                                </td>
                                <td className="px-3 py-3 text-slate-400 font-mono text-[11px]">
                                  {new Date(t.created_at).toLocaleDateString("pt-BR")}
                                </td>
                                <td className="px-3 py-3 text-slate-500 text-[11px] truncate max-w-[150px]">
                                  {t.closed_at ? new Date(t.closed_at).toLocaleDateString("pt-BR") : (t.closure_reason || "Em aberto")}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── FOOTER MODAL ─── */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0 print:hidden">
          <div className="text-xs text-slate-400">
            {machine.asset_id ? `CMDB Ativo #${machine.asset_id}` : "Estação sem ativo CMDB vinculado"}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
}
