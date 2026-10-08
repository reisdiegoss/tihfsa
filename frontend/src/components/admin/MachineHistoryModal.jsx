import { useState, useEffect } from "react";
import {
  FileText, Cpu, HardDrive, Wrench, Clock, CheckCircle2,
  AlertTriangle, AlertCircle, Info, Printer, X, RefreshCw,
  User, Building, Tag, ExternalLink, Activity, ArrowUpRight
} from "lucide-react";
import api from "../../api/client";

export default function MachineHistoryModal({ isOpen, onClose, machine }) {
  const [activeTab, setActiveTab] = useState("report"); // 'report' | 'tickets' | 'metrics'
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);

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

  useEffect(() => {
    if (isOpen && machine) {
      fetchHistory();
    }
  }, [isOpen, machine]);

  if (!isOpen || !machine) return null;

  const handlePrint = () => {
    window.print();
  };

  const tickets = historyData?.tickets || [];
  const metrics = historyData?.metrics_history || [];
  const recommendations = historyData?.hardware_recommendations || [];

  // Cálculos de picos e médias na telemetria
  const cpuVals = metrics.map((m) => m.cpu_usage_pct).filter((v) => v !== null && v !== undefined);
  const ramVals = metrics.map((m) => m.ram_usage_pct).filter((v) => v !== null && v !== undefined);
  const maxCpu = cpuVals.length > 0 ? Math.max(...cpuVals) : (machine.cpu_usage_pct || 0);
  const avgCpu = cpuVals.length > 0 ? Math.round(cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length) : (machine.cpu_usage_pct || 0);
  const maxRam = ramVals.length > 0 ? Math.max(...ramVals) : (machine.ram_usage_pct || 0);
  const avgRam = ramVals.length > 0 ? Math.round(ramVals.reduce((a, b) => a + b, 0) / ramVals.length) : (machine.ram_usage_pct || 0);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:fixed print:inset-0 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[94vh] flex flex-col print:max-h-none print:h-auto print:border-none print:shadow-none print:p-6 print:rounded-none">
        
        {/* ─── HEADER MODAL / RELATÓRIO ─── */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 shrink-0 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs">
              <FileText size={24} />
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
            onClick={() => setActiveTab("report")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "report"
                ? "bg-indigo-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText size={15} />
            <span>Relatório & Diagnóstico de Upgrade</span>
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

          <button
            type="button"
            onClick={() => setActiveTab("metrics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "metrics"
                ? "bg-indigo-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Activity size={15} />
            <span>Consumo de Hardware ({metrics.length})</span>
          </button>
        </div>

        {/* ─── CONTEÚDO SCROLLÁVEL ─── */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 print:overflow-visible">
          {loading ? (
            <div className="p-16 text-center text-slate-400 font-semibold space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-indigo-600" />
              <p className="text-xs">Processando telemetria e histórico do equipamento...</p>
            </div>
          ) : (
            <>
              {/* ──────────────────────────────────────────────────────────
                  ABA 1: RELATÓRIO TÉCNICO & DIAGNÓSTICO DE UPGRADE
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
                        Documento oficial de telemetria emitido em {new Date().toLocaleString("pt-BR")}.
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

                  {/* Resumo de Recursos & Telemetria Atual */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Processador (CPU)</span>
                      <p className="text-xl font-black text-slate-800 mt-1">{machine.cpu_usage_pct ?? 0}%</p>
                      <p className="text-[10px] text-slate-500 truncate" title={machine.cpu_model || "CPU"}>
                        {machine.cpu_model || "Pico: " + maxCpu + "%"}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Memória RAM</span>
                      <p className="text-xl font-black text-slate-800 mt-1">{machine.ram_usage_pct ?? 0}%</p>
                      <p className="text-[10px] text-slate-500">
                        {machine.ram_total_mb ? `${Math.round(machine.ram_total_mb / 1024)} GB Total` : "Pico: " + maxRam + "%"}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Armazenamento</span>
                      <p className="text-xl font-black text-slate-800 mt-1">
                        {machine.disk_metrics && machine.disk_metrics[0] ? `${machine.disk_metrics[0].used_pct}%` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {machine.disk_metrics && machine.disk_metrics[0] ? `${machine.disk_metrics[0].free_gb} GB livres` : "Sem dados"}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] font-black text-slate-400 uppercase">Histórico de Incidentes</span>
                      <p className="text-xl font-black text-slate-800 mt-1">{tickets.length}</p>
                      <p className="text-[10px] text-slate-500">Chamados registrados</p>
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
                      {avgRam >= 80 || (machine.ram_total_mb && machine.ram_total_mb <= 8192 && avgRam >= 70) ? (
                        <p>
                          • <strong>Upgrade de Memória RAM Prioritário:</strong> O consumo operacional de RAM se mantém em níveis críticos ({avgRam}% médio, atingindo pico de {maxRam}%). Recomenda-se a aquisição de módulo adicional para totalizar 16 GB ou 32 GB, evitando lentidão no sistema operacional.
                        </p>
                      ) : (
                        <p>
                          • <strong>Memória RAM Estável:</strong> A capacidade de {machine.ram_total_mb ? Math.round(machine.ram_total_mb / 1024) : 8} GB atende atualmente as atividades corporativas deste equipamento.
                        </p>
                      )}

                      {machine.disk_metrics && machine.disk_metrics.some((d) => d.used_pct >= 85) ? (
                        <p>
                          • <strong>Armazenamento em Alerta:</strong> Disco principal opera com espaço residual reduzido (&gt;85% de uso). Recomendada aquisição de SSD de 512 GB ou 1 TB para prevenção de perda de dados.
                        </p>
                      ) : (
                        <p>
                          • <strong>Armazenamento Adequado:</strong> Capacidade de disco suficiente para as rotinas atuais.
                        </p>
                      )}

                      {tickets.length >= 3 && (
                        <p>
                          • <strong>Atenção à Recorrência:</strong> Equipamento acumula {tickets.length} chamados de suporte técnico. Caso o custo de manutenção continue elevado, sugerir substituição programada.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────────────────────────────────────────────────
                  ABA 2: MANUTENÇÕES & CHAMADOS DO EQUIPAMENTO
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

              {/* ──────────────────────────────────────────────────────────
                  ABA 3: CONSUMO DE HARDWARE (MÉTRICAS TEMPORAIS)
                  ────────────────────────────────────────────────────────── */}
              {activeTab === "metrics" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">Histórico de Consumo de Hardware</h4>
                      <p className="text-xs text-slate-500">Últimas medições de telemetria coletadas pelo agente</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                      <span>Média CPU: <strong className="text-slate-900">{avgCpu}%</strong></span>
                      <span>Média RAM: <strong className="text-slate-900">{avgRam}%</strong></span>
                    </div>
                  </div>

                  {metrics.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Nenhuma amostra de telemetria histórica gravada ainda.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[460px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5">Data & Hora</th>
                            <th className="px-3 py-2.5">CPU (%)</th>
                            <th className="px-3 py-2.5">Memória RAM (%)</th>
                            <th className="px-3 py-2.5">Disco Principal</th>
                            <th className="px-3 py-2.5">Uptime</th>
                            <th className="px-3 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {metrics.map((m) => {
                            const cpu = m.cpu_usage_pct ?? 0;
                            const ram = m.ram_usage_pct ?? 0;
                            const pDisk = m.disk_metrics && m.disk_metrics[0] ? m.disk_metrics[0] : null;

                            return (
                              <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                                  {new Date(m.created_at).toLocaleString("pt-BR")}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${cpu >= 90 ? "bg-red-500" : cpu >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                                        style={{ width: `${Math.min(100, cpu)}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-xs">{cpu}%</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${ram >= 90 ? "bg-red-500" : ram >= 80 ? "bg-amber-500" : "bg-blue-500"}`}
                                        style={{ width: `${Math.min(100, ram)}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-xs">{ram}%</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">
                                  {pDisk ? `${pDisk.free_gb} GB livres (${pDisk.used_pct}%)` : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-slate-500 text-[11px]">
                                  {m.uptime_hours ? `${Math.round(m.uptime_hours)}h` : "—"}
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    m.status === "warning" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                                  }`}>
                                    {m.status}
                                  </span>
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
