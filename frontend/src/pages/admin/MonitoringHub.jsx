import { useState, useEffect, useRef } from "react";
import { 
  Activity, Ticket, Tv, ExternalLink, RefreshCw, 
  Clock, AlertTriangle, AlertCircle, ShieldAlert, CheckCircle2, 
  Users, Building, ChevronRight, Layers, ArrowUpRight, Flame,
  Volume2, VolumeX, BellRing, MessageSquare, X, Monitor
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import ZabbixPanel from "./ZabbixPanel";
import StationMonitoringTab from "../../components/admin/StationMonitoringTab";

// Instância única de AudioContext
let sharedAudioCtx = null;
const getAudioContext = () => {
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
};

// Assegura que o contexto de áudio esteja rodando (despausado)
const ensureAudioReady = async () => {
  let ctx = getAudioContext();
  if (!ctx) return null;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch (e) {
      console.warn("Autoplay bloqueou áudio:", e);
    }
  }

  // Se continuar suspenso ou fechado/interrompido, tenta criar um novo AudioContext
  if (ctx.state !== "running") {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
        ctx = sharedAudioCtx;
        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Falha ao recriar AudioContext:", e);
    }
  }

  return ctx.state === "running" ? ctx : null;
};

// Som 1: Chime de Novo Chamado (Harmonizado e suave, calibrado no padrão do NOC)
const playNewTicketChime = async () => {
  try {
    const ctx = await ensureAudioReady();
    if (!ctx) {
      console.warn("AudioContext não está em running");
      return false;
    }

    const now = ctx.currentTime + 0.05;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, now);
    masterGain.connect(ctx.destination);

    // Acorde harmônico ascendente suave C5 -> E5 -> G5 (suave, nível NOC)
    const notes = [
      { freq: 523.25, time: 0, dur: 0.35, gain: 0.20 },     // C5
      { freq: 659.25, time: 0.10, dur: 0.40, gain: 0.22 },   // E5
      { freq: 783.99, time: 0.20, dur: 0.55, gain: 0.25 }    // G5
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(n.freq, now + n.time);
      gain.gain.setValueAtTime(0.01, now + n.time);
      gain.gain.exponentialRampToValueAtTime(n.gain, now + n.time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.dur);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + n.time);
      osc.stop(now + n.time + n.dur + 0.02);
    });

    return true;
  } catch (err) {
    console.warn("Audio chime erro:", err);
    return false;
  }
};

// Som 2: Chime de resposta de solicitante / mensagem (Ding-Dong idêntico ao NOC)
const playRequesterReplyChime = async () => {
  try {
    const ctx = await ensureAudioReady();
    if (!ctx) return false;

    const now = ctx.currentTime + 0.05;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, now);
    masterGain.connect(ctx.destination);

    // Tom 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.01, now);
    gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.13);

    // Tom 2: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.08);
    gain2.gain.setValueAtTime(0.01, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.11);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.36);

    return true;
  } catch (err) {
    console.warn("Audio requester chime erro:", err);
    return false;
  }
};

// Som 3: Alerta urgente para chamados críticos ou estouro de SLA (moderado)
const playUrgentAlertSiren = async () => {
  try {
    const ctx = await ensureAudioReady();
    if (!ctx) return false;

    const now = ctx.currentTime + 0.05;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.20, now);
    masterGain.connect(ctx.destination);

    for (let i = 0; i < 2; i++) {
      const offset = i * 0.30;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(750, now + offset);
      osc.frequency.exponentialRampToValueAtTime(440, now + offset + 0.22);

      gain.gain.setValueAtTime(0.01, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, now + offset + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.25);

      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.26);
    }
    return true;
  } catch (err) {
    console.warn("Audio siren erro:", err);
    return false;
  }
};

const LAST_HUB_TICKET_KEY = "tihfsa_hub_last_seen_ticket_id";
const LAST_HUB_INTER_KEY = "tihfsa_hub_last_seen_inter_id";

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

  // Notificação visual flutuante (Toast ativo)
  const [activeToast, setActiveToast] = useState(null);

  // Áudio ativado por padrão
  const [audioEnabled, setAudioEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem("tihfsa_hub_audio_enabled");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const prevLatestTicketIdRef = useRef(null);
  const prevLatestCriticalIdRef = useRef(null);
  const prevBreachedCountRef = useRef(null);
  const prevLatestInterIdRef = useRef(null);

  const unlockAudio = async () => {
    const ctx = await ensureAudioReady();
    if (ctx && ctx.state === "running") {
      setAudioUnlocked(true);
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (sharedAudioCtx && sharedAudioCtx.state === "running") {
      setAudioUnlocked(true);
    }

    const handleFirstInteraction = async () => {
      await unlockAudio();
    };
    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("pointerdown", handleFirstInteraction);
    window.addEventListener("mousedown", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);
    window.addEventListener("touchstart", handleFirstInteraction);
    window.addEventListener("focus", handleFirstInteraction);
    return () => {
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("mousedown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("focus", handleFirstInteraction);
    };
  }, []);

  // Timer para dispensar o Toast flutuante após 15 segundos
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 15000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  const handleToggleAudio = async () => {
    const nextState = !audioEnabled;
    setAudioEnabled(nextState);
    try {
      localStorage.setItem("tihfsa_hub_audio_enabled", String(nextState));
    } catch (e) {}

    if (nextState) {
      const ok = await unlockAudio();
      if (ok) {
        await playNewTicketChime();
      }
    }
  };

  const handleTestAudio = async () => {
    const isReady = await unlockAudio();
    if (isReady) {
      const played = await playNewTicketChime();
      if (played) {
        setActiveToast({
          type: "test",
          badge: "TESTE DE SOM: SUCESSO 🔔",
          badgeClass: "bg-emerald-600 text-white font-black",
          title: "Sinal Sonoro Disparado (Padrão NOC)",
          subtitle: "Volume harmonizado suavemente com o alerta do NOC.",
          details: "O chime harmônico soará para novos chamados e respostas de solicitantes.",
          timestamp: new Date()
        });
        return;
      }
    }

    setActiveToast({
      type: "urgent",
      badge: "ÁUDIO BLOQUEADO PELO NAVEGADOR ⚠️",
      badgeClass: "bg-amber-500 text-slate-950 font-black animate-pulse",
      title: "Permissão de Som Exigida pelo Chrome",
      subtitle: "Clique em qualquer ponto desta tela para autorizar o áudio.",
      details: "O navegador requer interação do usuário nesta janela para tocar alertas.",
      timestamp: new Date()
    });
  };

  const triggerNewTicketAlert = (ticketInfo, isCritical) => {
    if (audioEnabled) {
      if (isCritical) {
        playUrgentAlertSiren();
      } else {
        playNewTicketChime();
      }
    }

    setActiveToast({
      type: isCritical ? "urgent" : "ticket",
      badge: isCritical ? "🚨 CHAMADO CRÍTICO" : "🔔 NOVO CHAMADO",
      badgeClass: isCritical 
        ? "bg-red-600 text-white font-black animate-pulse" 
        : "bg-blue-600 text-white font-black animate-pulse",
      title: ticketInfo ? `Chamado #${ticketInfo.id}: ${ticketInfo.title}` : "Novo Chamado Aberto no Sistema",
      subtitle: ticketInfo?.requester_name ? `Solicitante: ${ticketInfo.requester_name}` : "Aguardando triagem técnica",
      details: ticketInfo?.priority ? `Prioridade: ${ticketInfo.priority}` : "",
      timestamp: new Date()
    });
  };

  const triggerRequesterAlert = (activity) => {
    if (audioEnabled) {
      playRequesterReplyChime();
    }

    setActiveToast({
      type: "requester",
      badge: "💬 RESPOSTA DO SOLICITANTE",
      badgeClass: "bg-purple-600 text-white font-black animate-pulse",
      title: activity ? `Chamado #${activity.ticket_id}: ${activity.ticket_title}` : "Interação de Solicitante Recebida",
      subtitle: activity?.author_name ? `${activity.author_name} respondeu:` : "Nova mensagem adicionada",
      details: activity?.message ? `"${activity.message}"` : "",
      timestamp: new Date()
    });
  };

  const triggerUrgentAlert = (title, subtitle) => {
    if (audioEnabled) {
      playUrgentAlertSiren();
    }

    setActiveToast({
      type: "urgent",
      badge: "🚨 SLA ESTOURADO",
      badgeClass: "bg-red-600 text-white font-black animate-ping",
      title: title || "Atenção: Chamado com SLA Estourado!",
      subtitle: subtitle || "Verifique imediatamente a fila de atendimento",
      details: "Tempo máximo de resolução excedido.",
      timestamp: new Date()
    });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const fetchHelpdeskSummary = () => {
    setLoadingHelpdesk(true);
    api.get(`/monitoring/helpdesk/summary?period_days=${periodDays}`)
      .then((res) => {
        const data = res.data;
        setSummaryData(data);
        setLastUpdate(new Date());

        const curLatestId = data.latest_ticket_id || data.kpis?.latest_ticket_id || 0;
        const curLatestCriticalId = data.latest_critical_ticket_id || data.kpis?.latest_critical_ticket_id || 0;
        const curBreached = data.kpis?.sla_breached_count || data.kpis?.sla_estourado_count || 0;
        const curLatestInterId = data.latest_client_interaction_id || 0;

        let prevStoredTicketId = parseInt(localStorage.getItem(LAST_HUB_TICKET_KEY) || "0", 10);
        let prevStoredInterId = parseInt(localStorage.getItem(LAST_HUB_INTER_KEY) || "0", 10);

        if (prevLatestTicketIdRef.current === null) {
          prevLatestTicketIdRef.current = curLatestId;
          prevLatestCriticalIdRef.current = curLatestCriticalId;
          prevBreachedCountRef.current = curBreached;
          prevLatestInterIdRef.current = curLatestInterId;

          if (curLatestId > 0 && (prevStoredTicketId === 0 || curLatestId > prevStoredTicketId)) {
            const tDate = data.latest_ticket_info?.created_at ? new Date(data.latest_ticket_info.created_at) : null;
            const isFresh = tDate && (new Date() - tDate < 15 * 60 * 1000);
            if (isFresh) {
              const isCrit = curLatestCriticalId > 0 && curLatestCriticalId === curLatestId;
              triggerNewTicketAlert(data.latest_ticket_info, isCrit);
            }
          }

          if (curLatestInterId > 0 && (prevStoredInterId === 0 || curLatestInterId > prevStoredInterId)) {
            const iDate = data.latest_requester_activity?.created_at ? new Date(data.latest_requester_activity.created_at) : null;
            const isFresh = iDate && (new Date() - iDate < 15 * 60 * 1000);
            if (isFresh) {
              triggerRequesterAlert(data.latest_requester_activity);
            }
          }

          localStorage.setItem(LAST_HUB_TICKET_KEY, String(curLatestId));
          localStorage.setItem(LAST_HUB_INTER_KEY, String(curLatestInterId));
        } else {
          if (curLatestCriticalId > prevLatestCriticalIdRef.current) {
            triggerNewTicketAlert(data.latest_ticket_info, true);
          } else if (curLatestId > prevLatestTicketIdRef.current) {
            triggerNewTicketAlert(data.latest_ticket_info, false);
          } else if (curBreached > prevBreachedCountRef.current) {
            triggerUrgentAlert("Atenção: SLA Estourado!", `Total de ${curBreached} chamados com prazo estourado`);
          } else if (curLatestInterId > prevLatestInterIdRef.current) {
            triggerRequesterAlert(data.latest_requester_activity);
          }

          prevLatestTicketIdRef.current = curLatestId;
          prevLatestCriticalIdRef.current = curLatestCriticalId;
          prevBreachedCountRef.current = curBreached;
          prevLatestInterIdRef.current = curLatestInterId;

          localStorage.setItem(LAST_HUB_TICKET_KEY, String(curLatestId));
          localStorage.setItem(LAST_HUB_INTER_KEY, String(curLatestInterId));
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar dados de monitoramento do Helpdesk:", err);
      })
      .finally(() => setLoadingHelpdesk(false));
  };

  useEffect(() => {
    if (activeTab === "helpdesk") {
      fetchHelpdeskSummary();
      const interval = setInterval(fetchHelpdeskSummary, 15000); // 15s refresh
      return () => clearInterval(interval);
    }
  }, [activeTab, periodDays, audioEnabled]);

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

        {/* Botões Rápidos para Abertura das TVs e Alerta Sonoro */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Botão de Alerta Sonoro */}
          <button
            onClick={handleToggleAudio}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl transition-all font-bold text-xs cursor-pointer border ${
              audioEnabled 
                ? (audioUnlocked 
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-xs" 
                    : "bg-amber-50 text-amber-900 border-amber-300 shadow-xs animate-pulse")
                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
            }`}
            title={audioEnabled ? (audioUnlocked ? "Áudio Pronto (Potência Plena). Clique para silenciar." : "Clique para liberar áudio nesta tela.") : "Alerta Silenciado"}
          >
            {audioEnabled ? (
              audioUnlocked ? <Volume2 size={16} className="text-emerald-600" /> : <Volume2 size={16} className="text-amber-600 animate-ping" />
            ) : (
              <VolumeX size={16} />
            )}
            <span>{audioEnabled ? (audioUnlocked ? "Áudio Pronto" : "Liberar Áudio") : "Alerta Silenciado"}</span>
          </button>

          {/* Botão de Testar Som */}
          <button
            onClick={handleTestAudio}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all font-bold text-xs cursor-pointer shadow-xs"
            title="Testar alarme sonoro agora"
          >
            <BellRing size={16} className="text-indigo-600" />
            <span>Testar Som</span>
          </button>

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

      {/* Toast Flutuante de Alerta de Chamado / Resposta */}
      {activeToast && (
        <div 
          onClick={unlockAudio}
          className="fixed top-5 right-5 z-50 max-w-lg w-[calc(100%-2.5rem)] sm:w-auto bg-slate-900/95 border-2 border-amber-500/80 rounded-2xl p-4 shadow-[0_0_35px_rgba(245,158,11,0.4)] backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 cursor-pointer text-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 mt-0.5 border border-amber-500/30">
                {activeToast.type === "requester" ? (
                  <MessageSquare size={24} className="animate-pulse text-purple-400" />
                ) : activeToast.type === "urgent" ? (
                  <ShieldAlert size={24} className="animate-bounce text-red-500" />
                ) : (
                  <BellRing size={24} className="animate-bounce text-amber-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full ${activeToast.badgeClass || 'bg-blue-500 text-white font-black'}`}>
                    {activeToast.badge}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {activeToast.timestamp?.toLocaleTimeString("pt-BR")}
                  </span>
                </div>
                <h3 className="text-sm font-black text-white leading-snug">
                  {activeToast.title}
                </h3>
                {activeToast.subtitle && (
                  <p className="text-xs font-semibold text-slate-300 mt-1">
                    {activeToast.subtitle}
                  </p>
                )}
                {activeToast.details && (
                  <p className="text-xs text-slate-400 mt-1 italic line-clamp-2">
                    {activeToast.details}
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveToast(null); }}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Banner de Autorização de Áudio pelo Navegador (se ainda não clicou na tela) */}
      {audioEnabled && !audioUnlocked && (
        <div 
          onClick={unlockAudio}
          className="bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 shadow-xs cursor-pointer animate-pulse"
        >
          <div className="flex items-center gap-2.5">
            <Volume2 size={20} className="text-amber-600 shrink-0" />
            <span>
              O navegador restringe reprodução automática de áudio. <strong>Clique aqui ou em qualquer lugar da tela para autorizar os alertas sonoros!</strong>
            </span>
          </div>
          <span className="bg-amber-500 text-slate-950 font-black px-3.5 py-1 rounded-xl text-xs uppercase tracking-wider shrink-0 shadow-xs">
            Ativar Áudio
          </span>
        </div>
      )}

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

        <button
          onClick={() => handleTabChange("stations")}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "stations"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <Monitor size={17} />
          <span>Estações & Agentes (Telemetria)</span>
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

      {/* ======================================================== */}
      {/* ABA 3: ESTAÇÕES & AGENTES (SUBSTITUTO NATIVO ZABBIX)       */}
      {/* ======================================================== */}
      {activeTab === "stations" && (
        <StationMonitoringTab />
      )}

    </div>
  );
}
