import { useState, useEffect, useMemo } from "react";
import {
  Monitor, RefreshCw, Search, CheckCircle2, AlertTriangle,
  Clock, HardDrive, Cpu, Terminal, Copy, Check, Trash2,
  ExternalLink, User, Shield, Info, X, Zap, Download, Laptop, Tag
} from "lucide-react";
import api from "../../api/client";

export default function StationMonitoringTab() {
  const [data, setData] = useState({
    total_machines: 0,
    online_count: 0,
    warning_count: 0,
    offline_count: 0,
    machines: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'online', 'warning', 'offline'
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchMachines = () => {
    setLoading(true);
    api.get("/monitoring/agent/machines")
      .then((res) => {
        setData(res.data);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        console.error("Erro ao carregar telemetria de estações:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMachines();
    const interval = setInterval(fetchMachines, 15000); // Auto-refresh a cada 15s
    return () => clearInterval(interval);
  }, []);

  const handleDeleteMachine = async (id, hostname) => {
    if (!window.confirm(`Deseja remover a estação "${hostname}" do monitoramento?`)) return;
    try {
      await api.delete(`/monitoring/agent/machines/${id}`);
      fetchMachines();
    } catch (err) {
      alert("Erro ao excluir estação.");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 3000);
  };

  // Filtros
  const filteredMachines = useMemo(() => {
    return (data.machines || []).filter((m) => {
      const matchSearch =
        (m.hostname || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.logged_user || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.assigned_user_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.ip_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.brand || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.model || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.serial_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.os_name || "").toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter === "online") return m.is_online && m.status !== "warning";
      if (statusFilter === "warning") return m.status === "warning";
      if (statusFilter === "offline") return !m.is_online;

      return true;
    });
  }, [data.machines, searchTerm, statusFilter]);

  const [selectedOs, setSelectedOs] = useState("windows"); // 'windows' | 'linux'

  const apiBase = (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.startsWith("http"))
    ? import.meta.env.VITE_API_URL
    : `${window.location.origin}/api/v1`;

  const winOneLine = `(curl.exe -k -s "${apiBase}/monitoring/agent/script" | Out-String) | iex`;
  const winInstallOneLine = `(curl.exe -k -s "${apiBase}/monitoring/agent/install" | Out-String) | iex`;
  const linuxOneLine = `curl -k -s "${apiBase}/monitoring/agent/linux-script" | bash`;
  const linuxInstallOneLine = `curl -k -s "${apiBase}/monitoring/agent/linux-install" | sudo bash`;

  const activeOneLine = selectedOs === "windows" ? winInstallOneLine : linuxInstallOneLine;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── BANNER DE DOWNLOAD & COMANDOS DO AGENTE ─── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 rounded-3xl text-white shadow-lg border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Servidor Conectado
            </span>
            <span className="text-xs font-mono font-bold text-slate-300 truncate">
              {window.location.origin}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-black text-white">
              TIHFSA Sentinel Agent — Telemetria de Estações & Servidores
            </h3>
            {/* Seletor de SO no Banner */}
            <div className="inline-flex p-1 bg-slate-800/80 rounded-xl border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedOs("windows")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedOs === "windows" ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                }`}
              >
                🪟 Windows
              </button>
              <button
                type="button"
                onClick={() => setSelectedOs("linux")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedOs === "linux" ? "bg-amber-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                }`}
              >
                🐧 Linux (Ubuntu / Debian)
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 max-w-xl">
            {selectedOs === "windows"
              ? "Telemetria nativa para Windows 10, 11 e Windows Server (CPU, RAM, discos físicos/lógicos e usuário logado)."
              : "Telemetria nativa e leve para Ubuntu, Debian e derivadas (sem dependências externas, compatível com Servidores e Desktops)."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Botão de Download Direto do Script (.ps1 ou .sh) */}
          {selectedOs === "windows" ? (
            <>
              <a
                href={`${apiBase}/monitoring/agent/script?download=true`}
                download="tihfsa-agent.ps1"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all cursor-pointer shadow-xs"
                title="Baixar arquivo tihfsa-agent.ps1 já configurado com a URL deste servidor"
              >
                <Download size={15} className="text-emerald-400" />
                <span>Baixar Script (.ps1)</span>
              </a>
              <a
                href={`${apiBase}/monitoring/agent/ca.crt`}
                download="tihfsa-ca.crt"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 font-bold text-xs transition-all cursor-pointer shadow-xs"
                title="Baixar Certificado da Autoridade Raiz TIHFSA (Trusted Root CA para Windows / GPO)"
              >
                <Shield size={15} className="text-blue-400" />
                <span>Certificado SSL Raiz</span>
              </a>
            </>
          ) : (
            <a
              href={`${apiBase}/monitoring/agent/linux-script?download=true`}
              download="tihfsa-agent.sh"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all cursor-pointer shadow-xs"
              title="Baixar arquivo tihfsa-agent.sh já configurado com a URL deste servidor"
            >
              <Download size={15} className="text-amber-400" />
              <span>Baixar Script (.sh)</span>
            </a>
          )}

          {/* Botão Copiar Comando Rápido */}
          <button
            onClick={() => copyToClipboard(activeOneLine)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-extrabold text-xs transition-all shadow-md cursor-pointer ${
              selectedOs === "windows" ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"
            }`}
            title={`Copiar comando ${selectedOs === "windows" ? "PowerShell" : "Bash"} pronto para teste`}
          >
            {copiedCmd ? <Check size={15} className="text-emerald-300" /> : <Copy size={15} />}
            <span>{copiedCmd ? "Comando Copiado!" : `Copiar Comando (${selectedOs === "windows" ? "PowerShell" : "Bash"})`}</span>
          </button>

          {/* Botão Abrir Guia Completo */}
          <button
            onClick={() => setShowInstallModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer border border-white/10"
            title="Ver instruções detalhadas de instalação contínua"
          >
            <Terminal size={15} />
            <span className="hidden sm:inline">Guia Completo</span>
          </button>
        </div>
      </div>
      {/* ─── BARRA DE KPIs E CONTADORES ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div
          onClick={() => setStatusFilter("all")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-blue-50/80 border-blue-400 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Total de Estações</span>
            <Monitor size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{data.total_machines}</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Cadastradas no sistema</p>
        </div>

        {/* Online */}
        <div
          onClick={() => setStatusFilter("online")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "online"
              ? "bg-emerald-50/80 border-emerald-400 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">Online (Normais)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">{data.online_count - data.warning_count}</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Sinal nos últimos 3 min</p>
        </div>

        {/* Alerta / Atenção */}
        <div
          onClick={() => setStatusFilter("warning")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "warning"
              ? "bg-amber-50/80 border-amber-400 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-700 uppercase tracking-wider">Com Alerta</span>
            <AlertTriangle size={18} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-700 mt-2">{data.warning_count}</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Disco &gt;90% ou CPU &gt;95%</p>
        </div>

        {/* Offline */}
        <div
          onClick={() => setStatusFilter("offline")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "offline"
              ? "bg-slate-100 border-slate-400 shadow-sm"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Desconectadas</span>
            <Clock size={18} className="text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-700 mt-2">{data.offline_count}</p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">Sem sinal recente</p>
        </div>
      </div>

      {/* ─── TOOLBAR & AÇÕES ─── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Hostname, Usuário do Windows, IP..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-2.5 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowInstallModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs hover:from-blue-700 hover:to-indigo-700 transition-all shadow-xs cursor-pointer"
          >
            <Terminal size={15} />
            <span>Instalar Agente</span>
          </button>

          <button
            onClick={fetchMachines}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Atualizar agora"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* ─── GRID DE ESTAÇÕES MONITORADAS ─── */}
      {filteredMachines.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Monitor size={32} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">
              {searchTerm || statusFilter !== "all" ? "Nenhuma estação encontrada para este filtro" : "Nenhuma estação monitorada ainda"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Para começar a receber a telemetria em tempo real, execute o script do agente nas máquinas das estações de trabalho.
            </p>
          </div>
          <button
            onClick={() => setShowInstallModal(true)}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Ver comando de instalação em 1 minuto
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMachines.map((m) => {
            const cpu = m.cpu_usage_pct ?? 0;
            const ramPct = m.ram_usage_pct ?? 0;
            const primaryDisk = (m.disk_metrics && m.disk_metrics.length > 0) ? m.disk_metrics[0] : null;

            return (
              <div
                key={m.id}
                className={`bg-white rounded-2xl border transition-all p-5 space-y-4 relative overflow-hidden shadow-2xs hover:shadow-md ${
                  m.status === "warning"
                    ? "border-amber-300 ring-1 ring-amber-200"
                    : m.is_online
                    ? "border-slate-200 hover:border-blue-300"
                    : "border-slate-200 opacity-75 bg-slate-50/50"
                }`}
              >
                {/* Linha Topo: Hostname + Tipo + Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      m.status === "warning"
                        ? "bg-amber-100 text-amber-700"
                        : m.is_online
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-200 text-slate-500"
                    }`}>
                      {m.device_type === "Notebook" ? <Laptop size={20} /> : <Monitor size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900 truncate" title={m.hostname}>
                          {m.hostname}
                        </h4>
                        {m.device_type && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {m.device_type}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-slate-400 truncate">
                        {m.ip_address} {m.brand && m.brand !== "Desconhecido" ? `• ${m.brand}` : ""} {m.model && m.model !== "Desconhecido" ? `${m.model}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                      m.status === "warning"
                        ? "bg-amber-100 text-amber-800"
                        : m.is_online
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        m.status === "warning" ? "bg-amber-500" : m.is_online ? "bg-emerald-500" : "bg-slate-400"
                      }`} />
                      {m.status === "warning" ? "Atenção" : m.is_online ? "Online" : "Offline"}
                    </span>

                    <button
                      onClick={() => handleDeleteMachine(m.id, m.hostname)}
                      className="text-slate-300 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Remover máquina"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Usuário do Computador & Vínculo com Ativo no CMDB */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <User size={15} className="text-indigo-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase text-slate-400">Usuário do Computador</p>
                        <p className="text-xs font-black text-indigo-900 truncate" title={m.logged_user || "Sem usuário logado"}>
                          {m.logged_user || "Nenhum usuário interativo"}
                        </p>
                      </div>
                    </div>
                    {m.assigned_user_name ? (
                      <span className="text-[10px] font-bold bg-emerald-100/90 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md truncate shrink-0 max-w-[140px]" title={`Vinculado a: ${m.assigned_user_name}`}>
                        👤 {m.assigned_user_name}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold bg-slate-200/60 text-slate-500 px-1.5 py-0.5 rounded text-center shrink-0">
                        Não atribuído
                      </span>
                    )}
                  </div>

                  {/* Informações de Hardware & CMDB */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span className="truncate" title={m.serial_number ? `S/N: ${m.serial_number}` : ""}>
                      {m.serial_number && m.serial_number !== "Desconhecido" ? `S/N: ${m.serial_number}` : (m.os_name || "Windows")}
                    </span>
                    {m.asset_id && (
                      <a
                        href={`/admin/assets?assetId=${m.asset_id}&search=${encodeURIComponent(m.hostname)}`}
                        className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-800 hover:underline shrink-0"
                        title="Ver detalhes do ativo no CMDB"
                      >
                        <CheckCircle2 size={11} className="text-emerald-500" />
                        <span>CMDB #{m.asset_id}</span>
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </div>

                {/* Telemetria de Hardware: CPU & RAM */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {/* CPU */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1">
                        <Cpu size={12} className="text-blue-500" /> CPU
                      </span>
                      <span className={cpu >= 90 ? "text-red-600 font-black" : ""}>{cpu}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          cpu >= 90 ? "bg-red-500" : cpu >= 75 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, cpu)}%` }}
                      />
                    </div>
                  </div>

                  {/* RAM */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>RAM</span>
                      <span className={ramPct >= 90 ? "text-red-600 font-black" : ""}>{ramPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          ramPct >= 90 ? "bg-red-500" : ramPct >= 80 ? "bg-amber-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min(100, ramPct)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Disco Primário (C:) */}
                {primaryDisk && (
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span className="flex items-center gap-1">
                        <HardDrive size={12} className="text-purple-500" /> Disco {primaryDisk.drive}
                      </span>
                      <span className={primaryDisk.used_pct >= 90 ? "text-red-600 font-black" : ""}>
                        {primaryDisk.free_gb} GB livres ({primaryDisk.used_pct}% usado)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          primaryDisk.used_pct >= 90 ? "bg-red-500" : primaryDisk.used_pct >= 80 ? "bg-amber-500" : "bg-purple-500"
                        }`}
                        style={{ width: `${Math.min(100, primaryDisk.used_pct)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Rodapé: Uptime e Visto por último */}
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 pt-2 border-t border-slate-100">
                  <span>
                    {m.uptime_hours ? `Ligada há ${m.uptime_hours >= 24 ? `${Math.floor(m.uptime_hours / 24)}d ` : ""}${Math.round(m.uptime_hours % 24)}h` : "Uptime —"}
                  </span>
                  <span>
                    {m.seconds_ago < 60 ? "Visto agora" : `Visto há ${Math.round(m.seconds_ago / 60)} min`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── MODAL DE INSTALAÇÃO DO AGENTE ─── */}
      {showInstallModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <Terminal size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Instalação do TIHFSA Sentinel Agent</h3>
                  <p className="text-xs text-slate-500">Substituto nativo do Zabbix Agent para Windows</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Abas de SO no Modal */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setSelectedOs("windows")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedOs === "windows"
                    ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-xs"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span>🪟 Windows (PowerShell)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedOs("linux")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedOs === "linux"
                    ? "bg-amber-50 text-amber-800 border border-amber-200 shadow-xs"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span>🐧 Linux (Ubuntu / Debian)</span>
              </button>
            </div>

            {selectedOs === "windows" ? (
              <>
                {/* Opção 1: Teste Rápido Windows (1 Linha) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-500" /> 1. Teste Imediato (Executar 1 vez)
                    </h4>
                    <span className="text-[10px] text-slate-400">PowerShell como Administrador</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs flex items-center justify-between gap-2 overflow-x-auto">
                    <code className="truncate">{winOneLine}</code>
                    <button
                      onClick={() => copyToClipboard(winOneLine)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedCmd ? "Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                </div>

                {/* Opção 2: Instalação Permanente Windows */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield size={14} className="text-blue-500" /> 2. Instalação Permanente em 1 Clique (Agendador do Windows)
                    </h4>
                    <span className="text-[10px] text-slate-400">PowerShell (Admin)</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Instala em <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">C:\ProgramData\TIHFSA-Agent</code> e cria a Tarefa Agendada no Windows para rodar a cada 15 minutos em segundo plano invisível via SYSTEM.
                  </p>
                  <div className="p-3 bg-slate-900 rounded-xl text-blue-400 font-mono text-xs flex items-center justify-between gap-2 overflow-x-auto">
                    <code className="truncate">{winInstallOneLine}</code>
                    <button
                      onClick={() => copyToClipboard(winInstallOneLine)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedCmd ? "Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200/80 text-[11px] text-blue-900 flex items-start gap-2">
                    <span className="text-base shrink-0">🛡️</span>
                    <div>
                      <p className="font-bold">Comportamento Silencioso para Notebooks fora da rede:</p>
                      <p className="text-blue-800 mt-0.5">
                        Quando o usuário levar o notebook para casa ou viagens sem conexão direta com o servidor, o agente executa com timeout de 5 segundos e <strong>não exibe nenhum erro, aviso ou janela na tela</strong>. O envio é retomado automaticamente assim que a máquina conectar à rede ou VPN.
                      </p>
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200/80 text-[11px] text-emerald-950 flex items-start gap-2">
                    <span className="text-base shrink-0">🔒</span>
                    <div>
                      <p className="font-bold">Instalação Automática do Certificado SSL Raiz:</p>
                      <p className="text-emerald-900 mt-0.5">
                        O instalador e a execução periódica do agente verificam e instalam automaticamente a <strong>Autoridade Raiz TIHFSA</strong> no repositório de chaves do Windows. Os navegadores <strong>Edge e Chrome passam a confiar na conexão HTTPS</strong> sem aviso de segurança e sem necessidade de configuração manual.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Opção 1: Teste Rápido Linux */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-500" /> 1. Teste Imediato (Executar 1 vez)
                    </h4>
                    <span className="text-[10px] text-slate-400">Terminal Bash (Ubuntu / Debian)</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl text-amber-400 font-mono text-xs flex items-center justify-between gap-2 overflow-x-auto">
                    <code className="truncate">{linuxOneLine}</code>
                    <button
                      onClick={() => copyToClipboard(linuxOneLine)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedCmd ? "Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                </div>

                {/* Opção 2: Instalação Permanente Linux */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield size={14} className="text-emerald-500" /> 2. Instalação Permanente Automática (1-Clique via Root/Sudo)
                  </h4>
                  <p className="text-xs text-slate-600">
                    Instala em <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">/usr/local/bin/tihfsa-agent.sh</code> e agenda a execução no cron a cada 1 minuto (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono">/etc/cron.d/tihfsa-agent</code>):
                  </p>
                  <div className="p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs flex items-center justify-between gap-2 overflow-x-auto">
                    <code className="truncate">{linuxInstallOneLine}</code>
                    <button
                      onClick={() => copyToClipboard(linuxInstallOneLine)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCmd ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedCmd ? "Copiado!" : "Copiar"}</span>
                    </button>
                  </div>
                </div>

                {/* Opção 3: Passo a Passo Manual no Linux */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal size={14} className="text-slate-500" /> 3. Passo a Passo Manual (Opcional)
                  </h4>
                  <div className="p-3 bg-slate-900 rounded-xl text-slate-300 font-mono text-[11px] leading-relaxed relative group">
                    <pre className="overflow-x-auto whitespace-pre-wrap">{`sudo mkdir -p /usr/local/bin /etc/tihfsa
sudo curl -k -s "${apiBase}/monitoring/agent/linux-script" -o /usr/local/bin/tihfsa-agent.sh
sudo chmod +x /usr/local/bin/tihfsa-agent.sh
echo "* * * * * root /usr/local/bin/tihfsa-agent.sh >/dev/null 2>&1" | sudo tee /etc/cron.d/tihfsa-agent
sudo /usr/local/bin/tihfsa-agent.sh`}</pre>
                    <button
                      onClick={() => copyToClipboard(`sudo mkdir -p /usr/local/bin /etc/tihfsa\nsudo curl -k -s "${apiBase}/monitoring/agent/linux-script" -o /usr/local/bin/tihfsa-agent.sh\nsudo chmod +x /usr/local/bin/tihfsa-agent.sh\necho "* * * * * root /usr/local/bin/tihfsa-agent.sh >/dev/null 2>&1" | sudo tee /etc/cron.d/tihfsa-agent\nsudo /usr/local/bin/tihfsa-agent.sh`)}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Copy size={12} />
                      <span>Copiar Tudo</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-800">
              <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
              <span>
                <strong>Sem necessidade de reiniciar.</strong> Assim que o comando for executado, o host aparecerá no painel em até 10 segundos!
              </span>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowInstallModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
