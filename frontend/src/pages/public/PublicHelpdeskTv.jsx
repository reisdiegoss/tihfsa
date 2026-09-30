import { useState, useEffect, useRef } from "react";
import { 
  Tv, Clock, AlertTriangle, CheckCircle2, Volume2, VolumeX, Maximize2, Minimize2, 
  RefreshCw, UserCheck, UserX, Flame, Users, Layers, Activity, ArrowUpRight, 
  ShieldAlert, Sparkles, Building2, HelpCircle
} from "lucide-react";
import api from "../../api/client";

// Instância única de AudioContext com suporte a retomada em navegadores modernos
let sharedAudioCtx = null;

const getAudioContext = () => {
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
};

// Som 1: Chime de Novo Chamado (3 notas harmônicas agradáveis: C5 -> E5 -> G5)
const playNewTicketChime = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.12); // E5
    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.5);

    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(783.99, now + 0.25); // G5
    gain3.gain.setValueAtTime(0.4, now + 0.25);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.25);
    osc3.stop(now + 0.8);
  } catch (err) {
    console.warn("Web Audio API Chime erro:", err);
  }
};

// Som 2: Alerta Urgente (Chamado Crítico ou SLA Estourado)
const playUrgentAlertSiren = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.setValueAtTime(587.33, now + 0.2); // D5
    osc.frequency.setValueAtTime(880, now + 0.4); // A5

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.7);
  } catch (err) {
    console.warn("Web Audio API Siren erro:", err);
  }
};

export default function PublicHelpdeskTv() {
  const [data, setData] = useState({
    kpis: {
      total_abertos: 0,
      novos: 0,
      em_andamento: 0,
      aguardando_validacao: 0,
      criticos: 0,
      sem_tecnico: 0,
      sla_cumprido_pct: 100,
      sla_estourado_count: 0,
      sla_alerta_count: 0,
      tempo_medio_resolucao_horas: 0,
    },
    urgent_queue: [],
    technician_workload: [],
    department_stats: [],
    priority_distribution: {},
    sla_config: null
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [countdown, setCountdown] = useState(15);
  
  // Áudio ativado por padrão com persistência no LocalStorage
  const [audioEnabled, setAudioEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("tihfsa_tv_audio_enabled");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Refs de rastreamento para disparar som na detecção de alterações
  const prevLatestTicketIdRef = useRef(null);
  const prevLatestCriticalIdRef = useRef(null);
  const prevBreachedCountRef = useRef(null);

  // Desbloquear AudioContext com primeiro clique/toque
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().then(() => setAudioUnlocked(true)).catch(() => {});
      } else {
        setAudioUnlocked(true);
      }
    }
  };

  useEffect(() => {
    const handleFirstInteraction = () => {
      unlockAudio();
    };
    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);
    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  // Relógio ao vivo atualizado a cada segundo
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Monitorar tela cheia
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.warn(e));
    } else {
      document.exitFullscreen().catch((e) => console.warn(e));
    }
  };

  const handleToggleAudio = () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    try {
      localStorage.setItem("tihfsa_tv_audio_enabled", String(nextState));
    } catch (e) {}

    unlockAudio();
    if (nextState) {
      playNewTicketChime();
    }
  };

  // Carregar dados de monitoramento
  const fetchData = async () => {
    try {
      const res = await api.get("/monitoring/helpdesk/summary");
      const summary = res.data;
      setData(summary);
      setLastUpdate(new Date());
      setCountdown(15);

      const curLatestId = summary.latest_ticket_id || summary.kpis?.latest_ticket_id || 0;
      const curLatestCriticalId = summary.latest_critical_ticket_id || summary.kpis?.latest_critical_ticket_id || 0;
      const curBreached = summary.kpis?.sla_estourado_count || 0;

      // Na primeira carga, apenas memorizamos os IDs sem tocar alarme
      if (prevLatestTicketIdRef.current === null) {
        prevLatestTicketIdRef.current = curLatestId;
        prevLatestCriticalIdRef.current = curLatestCriticalId;
        prevBreachedCountRef.current = curBreached;
      } else {
        // Nas leituras seguintes, detecta novos chamados ou estouro de SLA
        if (audioEnabled) {
          if (curLatestCriticalId > prevLatestCriticalIdRef.current) {
            playUrgentAlertSiren();
          } else if (curLatestId > prevLatestTicketIdRef.current) {
            playNewTicketChime();
          } else if (curBreached > prevBreachedCountRef.current) {
            playUrgentAlertSiren();
          }
        }

        prevLatestTicketIdRef.current = curLatestId;
        prevLatestCriticalIdRef.current = curLatestCriticalId;
        prevBreachedCountRef.current = curBreached;
      }
    } catch (err) {
      console.error("Erro ao carregar dados do Wallboard de Helpdesk:", err);
    } finally {
      setLoading(false);
    }
  };

  // Loop de polling
  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [audioEnabled]);

  const kpis = data.kpis || {};
  const queue = data.urgent_queue || [];
  const technicians = data.technician_workload || [];
  const departments = data.department_stats || [];

  // Formatação de data/hora de Salvador
  const formattedTime = currentTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const formattedDate = currentTime.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const getPriorityBadge = (priority) => {
    const p = String(priority || "").toUpperCase();
    if (p.includes("CRIT") || p.includes("URG")) {
      return { label: "CRÍTICA", bg: "bg-red-500/20 text-red-400 border-red-500/40", pulse: true };
    }
    if (p.includes("ALT") || p.includes("HIGH")) {
      return { label: "ALTA", bg: "bg-amber-500/20 text-amber-400 border-amber-500/40", pulse: false };
    }
    if (p.includes("MED")) {
      return { label: "MÉDIA", bg: "bg-blue-500/20 text-blue-400 border-blue-500/40", pulse: false };
    }
    return { label: "BAIXA", bg: "bg-slate-500/20 text-slate-400 border-slate-500/40", pulse: false };
  };

  const getSlaDisplay = (ticket) => {
    const status = ticket.sla_status || ticket.sla?.status;
    const remaining = ticket.sla_remaining_minutes !== undefined 
      ? ticket.sla_remaining_minutes 
      : ticket.sla?.remaining_minutes;

    if (status === "BREACHED") {
      const overdueMins = Math.abs(remaining || 0);
      const hours = Math.floor(overdueMins / 60);
      const mins = overdueMins % 60;
      return {
        badgeText: "SLA ESTOURADO",
        timeText: `+${hours > 0 ? `${hours}h ` : ""}${mins}m de atraso`,
        badgeClass: "bg-red-500 text-white font-black animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]",
        borderClass: "border-red-500/50 bg-red-950/20",
      };
    }

    if (status === "WARNING") {
      const hours = Math.floor((remaining || 0) / 60);
      const mins = (remaining || 0) % 60;
      return {
        badgeText: "SLA EM RISCO",
        timeText: `Resta ${hours > 0 ? `${hours}h ` : ""}${mins}m`,
        badgeClass: "bg-amber-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(245,158,11,0.4)]",
        borderClass: "border-amber-500/40 bg-amber-950/10",
      };
    }

    const hours = Math.floor((remaining || 0) / 60);
    const mins = (remaining || 0) % 60;
    return {
      badgeText: "SLA NO PRAZO",
      timeText: `Resta ${hours > 0 ? `${hours}h ` : ""}${mins}m`,
      badgeClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
      borderClass: "border-slate-800 bg-slate-900/60",
    };
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans p-3 md:p-5 flex flex-col justify-between select-none">
      
      {/* ========================================================
          TOP HEADER: BRANDING, LIVE STATUS, CLOCK & TV CONTROLS
          ======================================================== */}
      <header className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-4 md:p-5 shadow-2xl backdrop-blur-md mb-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Left: Brand & Status */}
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 border border-blue-400/30 flex items-center justify-center text-white shadow-[0_0_25px_rgba(37,99,235,0.4)] shrink-0">
            <Tv size={30} className="drop-shadow" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase flex items-center gap-2">
                TIHFSA <span className="text-blue-500">•</span> HELPDESK TV
              </h1>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                AO VIVO
              </span>
            </div>
            <p className="text-xs md:text-sm font-semibold text-slate-400 mt-1 flex items-center gap-2">
              <span>Wallboard de Atendimento & SLA</span>
              <span className="text-slate-600">•</span>
              <span>Hotel Fasano Salvador</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Atualiza em <strong className="text-blue-400 font-mono text-sm">{countdown}s</strong></span>
            </p>
          </div>
        </div>

        {/* Center: Big Digital Clock */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl px-6 py-2.5 flex items-center gap-4 shadow-inner">
          <Clock className="text-blue-400" size={26} />
          <div className="text-left">
            <div className="text-2xl md:text-3xl font-black font-mono tracking-wider text-white">
              {formattedTime}
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider capitalize">
              {formattedDate}
            </div>
          </div>
        </div>

        {/* Right: TV Controls (Audio, Fullscreen, Refresh, NOC Link) */}
        <div className="flex items-center gap-2 md:gap-3 w-full lg:w-auto justify-end">
          {/* Audio Alert Toggle */}
          <button
            onClick={handleToggleAudio}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
              audioEnabled
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                : "bg-slate-800/60 text-slate-400 border-slate-700/60 hover:bg-slate-800 hover:text-white"
            }`}
            title="Ativar/desativar som na TV (Toca para novos chamados e chamados críticos)"
          >
            {audioEnabled ? <Volume2 size={18} className="animate-pulse text-amber-400" /> : <VolumeX size={18} />}
            <span className="hidden sm:inline">{audioEnabled ? "Alerta Sonoro Ativo" : "Alerta Silenciado"}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-slate-800/60 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
            title="Alternar Tela Cheia"
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            <span className="hidden sm:inline">{isFullscreen ? "Sair Tela Cheia" : "Tela Cheia"}</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800/60 text-slate-300 border border-slate-700/60 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
            title="Atualizar agora"
          >
            <RefreshCw size={18} className={loading ? "animate-spin text-blue-400" : ""} />
          </button>

          {/* Link rápido para TV NOC */}
          <a
            href="/noc"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600/30 transition-all cursor-pointer"
          >
            <Activity size={16} />
            <span>TV NOC</span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </header>

      {/* Banner de Autorização de Áudio pelo Navegador (se ainda não clicou na tela) */}
      {audioEnabled && !audioUnlocked && (
        <div 
          onClick={unlockAudio}
          className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold px-4 py-2.5 rounded-2xl mb-4 flex items-center justify-between gap-3 shadow-lg cursor-pointer animate-pulse"
        >
          <div className="flex items-center gap-2.5">
            <Volume2 size={20} className="text-amber-400 shrink-0" />
            <span>
              O navegador bloqueia som automático. <strong>Clique em qualquer local desta tela para autorizar os alertas sonoros na TV!</strong>
            </span>
          </div>
          <span className="bg-amber-500 text-slate-950 font-black px-3.5 py-1 rounded-xl text-xs uppercase tracking-wider shrink-0 shadow-sm">
            Ativar Áudio
          </span>
        </div>
      )}

      {/* ========================================================
          KPI CARDS GRID (HIGH CONTRAST & VISIBILITY FOR TV)
          ======================================================== */}
      <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        
        {/* Total Abertos */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Abertos</span>
            <Layers size={18} className="text-blue-400" />
          </div>
          <div className="text-3xl xl:text-4xl font-black text-white font-mono">{kpis.total_abertos ?? 0}</div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">Fila total ativa</div>
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Sem Atendente */}
        <div className={`rounded-2xl p-4 flex flex-col justify-between shadow-lg border relative overflow-hidden transition-all ${
          (kpis.sem_tecnico ?? 0) > 0 
            ? "bg-amber-950/20 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]" 
            : "bg-slate-900/80 border-slate-800/90"
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Sem Atendente</span>
            <UserX size={18} className={(kpis.sem_tecnico ?? 0) > 0 ? "text-amber-400 animate-pulse" : "text-slate-500"} />
          </div>
          <div className={`text-3xl xl:text-4xl font-black font-mono ${(kpis.sem_tecnico ?? 0) > 0 ? "text-amber-400" : "text-white"}`}>
            {kpis.sem_tecnico ?? 0}
          </div>
          <div className="text-[11px] font-semibold text-amber-500/80 mt-1">Aguardando triagem</div>
        </div>

        {/* Em Andamento */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Em Andamento</span>
            <UserCheck size={18} className="text-indigo-400" />
          </div>
          <div className="text-3xl xl:text-4xl font-black text-white font-mono">{kpis.em_andamento ?? 0}</div>
          <div className="text-[11px] font-semibold text-indigo-400/80 mt-1">Sendo atendidos</div>
        </div>

        {/* Aguardando Validação */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Em Validação</span>
            <CheckCircle2 size={18} className="text-teal-400" />
          </div>
          <div className="text-3xl xl:text-4xl font-black text-white font-mono">{kpis.aguardando_validacao ?? 0}</div>
          <div className="text-[11px] font-semibold text-teal-400/80 mt-1">Pendente usuário</div>
        </div>

        {/* Críticos / Urgentes */}
        <div className={`rounded-2xl p-4 flex flex-col justify-between shadow-lg border relative overflow-hidden transition-all ${
          (kpis.criticos ?? 0) > 0 
            ? "bg-red-950/40 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse" 
            : "bg-slate-900/80 border-slate-800/90"
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Críticos</span>
            <Flame size={18} className={(kpis.criticos ?? 0) > 0 ? "text-red-400" : "text-slate-500"} />
          </div>
          <div className={`text-3xl xl:text-4xl font-black font-mono ${(kpis.criticos ?? 0) > 0 ? "text-red-400" : "text-white"}`}>
            {kpis.criticos ?? 0}
          </div>
          <div className="text-[11px] font-semibold text-red-400 mt-1">Prioridade Máxima</div>
        </div>

        {/* Conformidade SLA */}
        <div className={`rounded-2xl p-4 flex flex-col justify-between shadow-lg border relative overflow-hidden transition-all ${
          (kpis.sla_cumprido_pct ?? 100) >= 90
            ? "bg-emerald-950/20 border-emerald-500/40"
            : (kpis.sla_cumprido_pct ?? 100) >= 75
            ? "bg-amber-950/20 border-amber-500/40"
            : "bg-red-950/30 border-red-500/50"
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">SLA Geral</span>
            <Sparkles size={18} className={
              (kpis.sla_cumprido_pct ?? 100) >= 90 ? "text-emerald-400" : "text-amber-400"
            } />
          </div>
          <div className={`text-3xl xl:text-4xl font-black font-mono ${
            (kpis.sla_cumprido_pct ?? 100) >= 90 ? "text-emerald-400" : (kpis.sla_cumprido_pct ?? 100) >= 75 ? "text-amber-400" : "text-red-400"
          }`}>
            {kpis.sla_cumprido_pct ?? 100}%
          </div>
          <div className="text-[11px] font-semibold text-slate-400 mt-1">Conformidade SLA</div>
        </div>

        {/* SLA Estourado */}
        <div className={`rounded-2xl p-4 flex flex-col justify-between shadow-lg border relative overflow-hidden transition-all ${
          (kpis.sla_estourado_count ?? 0) > 0
            ? "bg-red-950/40 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.35)]"
            : "bg-slate-900/80 border-slate-800/90"
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">SLA Estourado</span>
            <ShieldAlert size={18} className={(kpis.sla_estourado_count ?? 0) > 0 ? "text-red-400 animate-bounce" : "text-slate-500"} />
          </div>
          <div className={`text-3xl xl:text-4xl font-black font-mono ${(kpis.sla_estourado_count ?? 0) > 0 ? "text-red-400" : "text-slate-200"}`}>
            {kpis.sla_estourado_count ?? 0}
          </div>
          <div className="text-[11px] font-semibold text-red-400 mt-1">Prazo vencido</div>
        </div>

      </section>

      {/* ========================================================
          MAIN BODY: URGENT QUEUE (LEFT) + WORKLOAD & DEPARTMENTS (RIGHT)
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        
        {/* Left Column: Fila de Chamados com Timer Regressivo de SLA */}
        <div className="lg:col-span-8 bg-slate-900/80 border border-slate-800/80 rounded-3xl p-5 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <Activity size={22} />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    Fila Prioritária de Chamados & SLA
                  </h2>
                  <p className="text-xs text-slate-400">Ordenado por urgência e tempo restante de SLA</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700/60">
                Mostrando {queue.length} chamados em foco
              </span>
            </div>

            {/* List of Tickets */}
            <div className="space-y-3 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
              {queue.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                  <CheckCircle2 size={48} className="mx-auto text-emerald-500/60 mb-3" />
                  <p className="text-base font-bold text-slate-300">Fila livre ou todos os chamados em dia!</p>
                  <p className="text-xs text-slate-500 mt-1">Nenhum chamado pendente no momento.</p>
                </div>
              ) : (
                queue.map((ticket) => {
                  const prio = getPriorityBadge(ticket.priority);
                  const sla = getSlaDisplay(ticket);

                  return (
                    <div
                      key={ticket.id}
                      className={`p-3.5 md:p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md ${sla.borderClass}`}
                    >
                      {/* Ticket Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* ID Badge */}
                        <div className="shrink-0 bg-slate-800/90 border border-slate-700 text-slate-200 font-mono font-black text-xs px-2.5 py-1.5 rounded-lg text-center shadow-inner">
                          #{ticket.id}
                        </div>

                        {/* Title, Category & Requester */}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h3 className="font-extrabold text-white text-sm md:text-base truncate">
                              {ticket.title}
                            </h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                              {ticket.category_name || "Geral"}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${prio.bg} ${prio.pulse ? "animate-pulse" : ""}`}>
                              {prio.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <span className="text-slate-500">Solicitante:</span>
                              <strong className="text-slate-300 font-semibold">{ticket.requester_name || "Colaborador"}</strong>
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Building2 size={13} className="text-slate-500" />
                              <strong className="text-slate-300 font-semibold">{ticket.department_name || "Geral"}</strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Details: Assigned Technician & SLA Badge */}
                      <div className="flex items-center gap-3 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-800/60">
                        {/* Technician */}
                        <div className="flex items-center gap-2">
                          {ticket.assigned_name ? (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-950/40 border border-blue-500/30 text-blue-300 text-xs font-bold">
                              <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">
                                {ticket.assigned_name.slice(0, 1).toUpperCase()}
                              </div>
                              <span className="truncate max-w-[100px]">{ticket.assigned_name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-black animate-pulse">
                              <UserX size={14} />
                              <span>Sem Técnico</span>
                            </div>
                          )}
                        </div>

                        {/* SLA Countdown Badge */}
                        <div className="text-right">
                          <div className={`px-3 py-1 rounded-xl text-xs uppercase tracking-wider inline-block ${sla.badgeClass}`}>
                            {sla.badgeText}
                          </div>
                          <div className="text-[11px] font-bold text-slate-300 mt-1 font-mono">
                            {sla.timeText}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Carga de Técnicos & Ranking de Setores */}
        <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
          
          {/* Card: Técnicos em Ação */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-5 shadow-2xl flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Users size={18} />
                  </div>
                  <h3 className="font-extrabold text-white text-base uppercase tracking-tight">
                    Carga por Técnico
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-500">
                  {technicians.length} ativos
                </span>
              </div>

              <div className="space-y-2.5">
                {technicians.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">Nenhum técnico alocado no momento</p>
                ) : (
                  technicians.map((tech) => (
                    <div
                      key={tech.id}
                      className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {tech.name ? tech.name.slice(0, 2).toUpperCase() : "TI"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{tech.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {tech.in_progress} em atendimento • {tech.pending} na fila
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono border ${
                          tech.active_tickets > 5 
                            ? "bg-red-500/20 text-red-400 border-red-500/40" 
                            : tech.active_tickets > 2
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                            : "bg-blue-500/20 text-blue-400 border-blue-500/40"
                        }`}>
                          {tech.active_tickets} chamados
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Card: Gargalos e Setores Demandantes */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-5 shadow-2xl flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-600/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                    <Building2 size={18} />
                  </div>
                  <h3 className="font-extrabold text-white text-base uppercase tracking-tight">
                    Setores Mais Acionados
                  </h3>
                </div>
                <span className="text-xs font-bold text-slate-500">Ranking</span>
              </div>

              <div className="space-y-2.5">
                {departments.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">Nenhum chamado aberto</p>
                ) : (
                  departments.slice(0, 4).map((dept, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-300 truncate max-w-[180px]">{dept.department_name}</span>
                        <span className="text-slate-400 font-mono font-bold">{dept.ticket_count} chamados</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-teal-500 to-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.round((dept.ticket_count / Math.max(1, kpis.total_abertos || 1)) * 100))}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* SLA ITIL Note */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>SLA Operacional Padrão TIHFSA</span>
              <span className="text-blue-400 font-semibold">MTTR: {kpis.tempo_medio_resolucao_horas || 0}h</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
