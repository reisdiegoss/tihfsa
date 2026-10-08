import { useState, useEffect } from "react";
import {
  FileText, Cpu, HardDrive, Wrench, Clock, CheckCircle2,
  AlertTriangle, AlertCircle, Info, Printer, X, RefreshCw,
  User, Building, Tag, ExternalLink, Activity, ArrowUpRight,
  TrendingUp, Calendar, Zap, Layers, BarChart2
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine
} from "recharts";
import api from "../../api/client";

export default function MachineHistoryModal({ isOpen, onClose, machine }) {
  const [activeTab, setActiveTab] = useState("metrics"); // 'metrics' | 'report' | 'tickets'
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);

  // Estados do Gráfico Temporal & Degradação
  const [chartRange, setChartRange] = useState("24h"); // '24h', '7d', '30d', '90d', '1y', 'all'
  const [chartLoading, setChartLoading] = useState(false);
  const [chartData, setChartData] = useState(null);

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
      fetchHistory();
      fetchChartData(chartRange);
    }
  }, [isOpen, machine]);

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
        <div className="flex items-center gap-2 border-b border-slate-100 py-3 shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab("metrics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
            onClick={() => setActiveTab("report")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                            dataKey="disk_pct"
                            name="Disco Principal C: (%)"
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

                    <div className="p-3.5 bg-pink-50/60 border border-pink-200/80 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black uppercase text-pink-700 tracking-wider">Disco C:</span>
                      <p className="text-2xl font-black text-pink-950">{summary.current_disk ?? 0}%</p>
                      <div className="flex justify-between text-[10px] text-pink-800 font-mono">
                        <span>Média: {summary.avg_disk ?? 0}%</span>
                        <span>Pico: {summary.peak_disk ?? 0}%</span>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Telemetria Auditada</span>
                      <p className="text-2xl font-black text-slate-800">{summary.total_samples ?? metrics.length}</p>
                      <p className="text-[10px] text-slate-400">Medições de 15 em 15 min</p>
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
                  ABA 2: RELATÓRIO TÉCNICO & DIAGNÓSTICO DE UPGRADE
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
