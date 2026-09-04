import { useState, useEffect, useRef } from "react";
import { 
  Server, HardDrive, Wifi, Phone, Shield, Cloud, Monitor, Activity, Zap,
  Plus, Save, Trash2, Edit3, Move, RefreshCw, AlertCircle, CheckCircle, Link as LinkIcon, X, Maximize2,
  ZoomIn, ZoomOut, RotateCcw, Hand, Minimize2, Bell, Volume2, VolumeX, Copy, Layers, ListFilter, ChevronDown, Crosshair
} from "lucide-react";
import api from "../../api/client";
const UnifiMetricsBlock = ({ unifiDev, selectedMetrics }) => {
  if (!unifiDev) return null;
  // If selectedMetrics array is explicitly empty, don't render the block at all
  if (selectedMetrics && selectedMetrics.length === 0) return null;
  
  // Default to all metrics if not specified (retro-compatibility)
  const showMetric = (metric) => !selectedMetrics || selectedMetrics.includes(metric);
  
  // Parse metrics
  const cpu = unifiDev.system_stats?.cpu || unifiDev['system-stats']?.cpu || 0;
  const mem = unifiDev.system_stats?.mem || unifiDev['system-stats']?.mem || 0;
  const fw = unifiDev.version || "N/A";
  const uptimeSecs = unifiDev.uptime || 0;
  const uptimeDays = Math.floor(uptimeSecs / 86400);
  const isAP = unifiDev.type === 'uap';
  
  // Switch specific: Aggregate port rates
  let totalRxRate = 0;
  let totalTxRate = 0;
  if (!isAP && unifiDev.port_table && showMetric('rx_tx')) {
     unifiDev.port_table.forEach(p => {
         if (p.up && p['rx_bytes-r']) totalRxRate += p['rx_bytes-r'];
         if (p.up && p['tx_bytes-r']) totalTxRate += p['tx_bytes-r'];
     });
  }
  
  const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B/s';
      const k = 1024;
      const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="mt-2 space-y-1.5 border-t border-slate-700/50 pt-2 w-full">
      <div className="bg-blue-950/40 rounded-lg p-1.5 border border-blue-900/50 text-[9px] flex flex-col gap-1 shadow-inner">
        
        {/* Header */}
        <div className="flex items-center justify-between font-bold border-b border-blue-900/50 pb-1 mb-0.5 text-blue-300">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            UniFi {isAP ? 'AP' : 'Switch'}
          </span>
          <span className={unifiDev.state === 1 ? "text-emerald-400 flex items-center gap-1" : "text-amber-400 flex items-center gap-1"}>
            <span className={`w-1.5 h-1.5 rounded-full ${unifiDev.state === 1 ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'}`} />
            {unifiDev.state === 1 ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* Common Metrics */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-0.5">
          {showMetric('cpu') && (
          <div className="flex justify-between items-center text-slate-400 font-mono text-[8.5px]">
            <span>CPU</span>
            <span className={cpu > 80 ? "text-red-400 font-bold" : "text-blue-300"}>{parseFloat(cpu).toFixed(1)}%</span>
          </div>
          )}
          {showMetric('ram') && (
          <div className="flex justify-between items-center text-slate-400 font-mono text-[8.5px]">
            <span>RAM</span>
            <span className={mem > 80 ? "text-red-400 font-bold" : "text-blue-300"}>{parseFloat(mem).toFixed(1)}%</span>
          </div>
          )}
          {showMetric('uptime') && (
          <div className="flex justify-between items-center text-slate-400 font-mono text-[8.5px]">
            <span>Uptime</span>
            <span className="text-slate-300">{uptimeDays > 0 ? `${uptimeDays}d` : `${Math.floor(uptimeSecs/3600)}h`}</span>
          </div>
          )}
          {showMetric('fw') && (
          <div className="flex justify-between items-center text-slate-400 font-mono text-[8.5px]">
            <span>Fw</span>
            <span className="text-slate-300 truncate max-w-[40px]" title={fw}>{fw}</span>
          </div>
          )}
        </div>

        {/* Access Point Specific */}
        {isAP && (showMetric('wifi_experience') || showMetric('clients') || showMetric('channel_utilization')) && (
          <div className="mt-1 pt-1 border-t border-blue-900/30 flex flex-col gap-1">
            {showMetric('wifi_experience') && (
            <div className="flex justify-between items-center text-slate-400 font-mono text-[8.5px]">
              <span className="font-bold text-blue-200">WiFi Experience</span>
              <span className={unifiDev.satisfaction < 70 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                {unifiDev.satisfaction || 0}%
              </span>
            </div>
            )}
            {showMetric('clients') && (
            <div className="flex justify-between items-center text-slate-400 font-mono text-[8.5px]">
              <span>Clientes Conectados</span>
              <span className="text-blue-300 font-bold">{unifiDev.num_sta || 0}</span>
            </div>
            )}
            
            {/* Radio Table (Channel Utilization) */}
            {showMetric('channel_utilization') && unifiDev.radio_table_stats && unifiDev.radio_table_stats.map((radio, idx) => (
              <div key={idx} className="flex justify-between items-center text-slate-400 font-mono text-[8.5px] bg-slate-900/40 px-1 rounded">
                <span>{radio.radio === 'ng' ? '2.4G' : (radio.radio === 'na' ? '5G' : '6G')} (CH {radio.channel})</span>
                <span className={radio.cu_total > 70 ? "text-amber-400" : "text-slate-300"}>Uso: {radio.cu_total || 0}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Switch Specific */}
        {!isAP && (showMetric('lan_experience') || showMetric('rx_tx')) && (
          <div className="mt-1 pt-1 border-t border-blue-900/30 flex flex-col gap-1">
            {showMetric('lan_experience') && (
            <div className="flex justify-between items-center text-slate-400 font-mono text-[8.5px]">
              <span className="font-bold text-blue-200">Experiência LAN</span>
              <span className={unifiDev.satisfaction < 90 ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
                {unifiDev.satisfaction || 100}%
              </span>
            </div>
            )}
            {showMetric('rx_tx') && (
              <>
                <div className="flex justify-between items-center text-slate-400 font-mono text-[8.5px] bg-slate-900/40 px-1 rounded">
                  <span className="flex items-center gap-1"><span className="text-emerald-500">↓</span> RX Rate</span>
                  <span className="text-slate-300">{formatBytes(totalRxRate)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400 font-mono text-[8.5px] bg-slate-900/40 px-1 rounded">
                  <span className="flex items-center gap-1"><span className="text-blue-400">↑</span> TX Rate</span>
                  <span className="text-slate-300">{formatBytes(totalTxRate)}</span>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

// Helpers para persistência de resolução (zoom) e posicionamento (pan) em Cookies e LocalStorage (TVs e monitores)
const saveTvViewport = (mapId, zoom, pan) => {
  if (!mapId) return;
  try {
    const payload = JSON.stringify({ zoom, pan });
    localStorage.setItem(`tihfsa_noc_viewport_${mapId}`, payload);
    const encoded = encodeURIComponent(payload);
    document.cookie = `tihfsa_noc_viewport_${mapId}=${encoded}; max-age=31536000; path=/; samesite=lax`;
  } catch (err) {
    console.warn("Erro ao salvar viewport no cookie/localStorage:", err);
  }
};

const getTvViewport = (mapId) => {
  if (!mapId) return null;
  try {
    // 1. Tentar ler do localStorage primeiro
    const local = localStorage.getItem(`tihfsa_noc_viewport_${mapId}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (typeof parsed.zoom === 'number' && parsed.pan) return parsed;
    }

    // 2. Fallback para Cookies
    const match = document.cookie.match(new RegExp(`(^|;\\s*)tihfsa_noc_viewport_${mapId}=([^;]*)`));
    if (match && match[2]) {
      const parsed = JSON.parse(decodeURIComponent(match[2]));
      if (typeof parsed.zoom === 'number' && parsed.pan) return parsed;
    }
  } catch (err) {
    console.warn("Erro ao recuperar viewport do cookie/localStorage:", err);
  }
  return null;
};


// Paleta de temas visuais para Áreas / Blocos de Agrupamento (suporta SVG e DOM)
const ZONE_COLOR_THEMES = {
  blue: {
    key: "blue",
    name: "Azul Índigo",
    stroke: "#3b82f6",
    fill: "rgba(59, 130, 246, 0.07)",
    fillSelected: "rgba(59, 130, 246, 0.16)",
    glow: "rgba(59, 130, 246, 0.4)",
    border: "border-blue-500/60",
    bg: "bg-blue-950/20",
    headerBg: "bg-blue-900/90 text-blue-100 border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]",
    accent: "text-blue-400",
    ring: "ring-blue-500",
    badge: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    dot: "bg-blue-400",
  },
  emerald: {
    key: "emerald",
    name: "Verde Esmeralda",
    stroke: "#10b981",
    fill: "rgba(16, 185, 129, 0.07)",
    fillSelected: "rgba(16, 185, 129, 0.16)",
    glow: "rgba(16, 185, 129, 0.4)",
    border: "border-emerald-500/60",
    bg: "bg-emerald-950/20",
    headerBg: "bg-emerald-900/90 text-emerald-100 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
    accent: "text-emerald-400",
    ring: "ring-emerald-500",
    badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  purple: {
    key: "purple",
    name: "Roxo / Violeta",
    stroke: "#a855f7",
    fill: "rgba(168, 85, 247, 0.07)",
    fillSelected: "rgba(168, 85, 247, 0.16)",
    glow: "rgba(168, 85, 247, 0.4)",
    border: "border-purple-500/60",
    bg: "bg-purple-950/20",
    headerBg: "bg-purple-900/90 text-purple-100 border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]",
    accent: "text-purple-400",
    ring: "ring-purple-500",
    badge: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
    dot: "bg-purple-400",
  },
  amber: {
    key: "amber",
    name: "Âmbar / Laranja",
    stroke: "#f59e0b",
    fill: "rgba(245, 158, 11, 0.07)",
    fillSelected: "rgba(245, 158, 11, 0.16)",
    glow: "rgba(245, 158, 11, 0.4)",
    border: "border-amber-500/60",
    bg: "bg-amber-950/20",
    headerBg: "bg-amber-900/90 text-amber-100 border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.3)]",
    accent: "text-amber-400",
    ring: "ring-amber-500",
    badge: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    dot: "bg-amber-400",
  },
  rose: {
    key: "rose",
    name: "Rosa / Carmim",
    stroke: "#f43f5e",
    fill: "rgba(244, 63, 94, 0.07)",
    fillSelected: "rgba(244, 63, 94, 0.16)",
    glow: "rgba(244, 63, 94, 0.4)",
    border: "border-rose-500/60",
    bg: "bg-rose-950/20",
    headerBg: "bg-rose-900/90 text-rose-100 border-rose-400/50 shadow-[0_0_15px_rgba(244,63,94,0.3)]",
    accent: "text-rose-400",
    ring: "ring-rose-500",
    badge: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
    dot: "bg-rose-400",
  },
  cyan: {
    key: "cyan",
    name: "Ciano / Turquesa",
    stroke: "#06b6d4",
    fill: "rgba(6, 182, 212, 0.07)",
    fillSelected: "rgba(6, 182, 212, 0.16)",
    glow: "rgba(6, 182, 212, 0.4)",
    border: "border-cyan-500/60",
    bg: "bg-cyan-950/20",
    headerBg: "bg-cyan-900/90 text-cyan-100 border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.3)]",
    accent: "text-cyan-400",
    ring: "ring-cyan-500",
    badge: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
    dot: "bg-cyan-400",
  },
};

// Calcula as dimensões reais e precisas de um card no canvas de acordo com seu conteúdo e métricas
const getNodeRealDimensions = (node) => {
  const isRack = node.icon_type === 'Rack';
  const isZone = node.icon_type === 'Zone';
  const childCount = node.child_asset_ids?.length || 0;
  const w = node.width || (isRack || isZone ? 280 : 220);
  
  if (node.height) {
    return { w, h: Number(node.height) };
  }
  
  if (isRack) {
    return { w, h: Math.max(160, 100 + childCount * 48) };
  }
  
  const showIp = node.display_options?.show_ip ?? node.rack_display_options?.show_ip ?? true;
  const unifiMetrics = node.display_options?.unifi_metrics ?? node.rack_display_options?.unifi_metrics ?? [];
  const zabbixMetrics = node.zabbix_selected_metrics || [];
  
  let h = 95;
  if (node.label && node.label.length > 24) h += 20;
  if (node.ip_address && showIp) h += 18;
  if (node.zone_id) h += 26;
  
  if (unifiMetrics.length > 0) {
    h += 45;
    if (unifiMetrics.includes('wifi_experience') || unifiMetrics.includes('cpu') || unifiMetrics.includes('ram') || unifiMetrics.includes('uptime') || unifiMetrics.includes('fw')) {
      h += 35;
    }
    if (unifiMetrics.includes('clients') || unifiMetrics.includes('channel_utilization') || unifiMetrics.includes('lan_experience') || unifiMetrics.includes('rx_tx')) {
      h += 35;
    }
  } else if (zabbixMetrics.length > 0) {
    h += 30 + zabbixMetrics.length * 20;
  }
  
  if (childCount > 0) {
    h += 25 + childCount * 42;
  }
  
  return { w, h: Math.max(130, h) };
};

// Algoritmo Convex Hull (Envoltória Convexa 2D - Monotone Chain)
const computeConvexHull = (points) => {
  if (!points || points.length <= 2) return points || [];
  const sorted = [...points].sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  
  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  
  lower.pop();
  upper.pop();
  return lower.concat(upper);
};

// Gera um caminho SVG suavizado com curvas Bezier quadráticas arredondando os vértices do polígono
const getRoundedPolygonPath = (points, radius = 28) => {
  if (!points || points.length < 3) return "";
  
  const n = points.length;
  const path = [];
  
  for (let i = 0; i < n; i++) {
    const pPrev = points[(i - 1 + n) % n];
    const pCurr = points[i];
    const pNext = points[(i + 1) % n];
    
    const v1 = { x: pPrev.x - pCurr.x, y: pPrev.y - pCurr.y };
    const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };
    
    const d1 = Math.hypot(v1.x, v1.y);
    const d2 = Math.hypot(v2.x, v2.y);
    
    if (d1 === 0 || d2 === 0) continue;
    
    const r = Math.min(radius, d1 / 2, d2 / 2);
    
    const c1 = { x: pCurr.x + (v1.x / d1) * r, y: pCurr.y + (v1.y / d1) * r };
    const c2 = { x: pCurr.x + (v2.x / d2) * r, y: pCurr.y + (v2.y / d2) * r };
    
    if (path.length === 0) {
      path.push(`M ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}`);
      path.push(`Q ${pCurr.x.toFixed(1)} ${pCurr.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}`);
    } else {
      path.push(`L ${c1.x.toFixed(1)} ${c1.y.toFixed(1)}`);
      path.push(`Q ${pCurr.x.toFixed(1)} ${pCurr.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)}`);
    }
  }
  
  path.push("Z");
  return path.join(" ");
};

// Calcula a geometria dinâmica adaptativa da Área / Bloco (molda-se aos dispositivos em tempo real)
const getZoneGeometry = (zone, allNodes) => {
  const members = (allNodes || []).filter(
    n => String(n.zone_id) === String(zone.id) && String(n.id) !== String(zone.id) && n.icon_type !== 'Zone'
  );

  if (members.length === 0) {
    const x = zone.x || 100;
    const y = zone.y || 100;
    const w = zone.width || 380;
    const h = zone.height || 240;
    return {
      minX: x,
      minY: y,
      maxX: x + w,
      maxY: y + h,
      width: w,
      height: h,
      headerX: x + 24,
      headerY: y - 18,
      membersCount: 0,
      hasMembers: false,
      path: "",
    };
  }

  const padX = 30;
  const padTop = 48;
  const padBottom = 30;

  const allPoints = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  members.forEach(m => {
    const dim = getNodeRealDimensions(m);
    const mx1 = m.x - padX;
    const my1 = m.y - padTop;
    const mx2 = m.x + dim.w + padX;
    const my2 = m.y + dim.h + padBottom;

    if (mx1 < minX) minX = mx1;
    if (my1 < minY) minY = my1;
    if (mx2 > maxX) maxX = mx2;
    if (my2 > maxY) maxY = my2;

    allPoints.push({ x: mx1, y: my1 });
    allPoints.push({ x: mx2, y: my1 });
    allPoints.push({ x: mx2, y: my2 });
    allPoints.push({ x: mx1, y: my2 });
  });

  const hull = computeConvexHull(allPoints);
  const path = getRoundedPolygonPath(hull, 32);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    headerX: minX + 24,
    headerY: minY - 18,
    membersCount: members.length,
    hasMembers: true,
    hull,
    path,
  };
};

// Retrocompatibilidade para limites da área
const getZoneBounds = (zone, allNodes) => {
  const geom = getZoneGeometry(zone, allNodes);
  return {
    x: geom.minX,
    y: geom.minY,
    width: geom.width,
    height: geom.height,
    membersCount: geom.membersCount,
    hasMembers: geom.hasMembers,
  };
};

export default function TopologyMapBuilder({ mapId, isPublicView = false, onMapLoaded, refreshTrigger }) {
  const [mapData, setMapData] = useState({
    id: null,
    name: "Topologia Geral de Rede TIHFSA",
    description: "Diagrama interativo de infraestrutura (Switches, Antenas, Telefones IP, Servidores)",
    nodes_data: [],
    edges_data: [],
  });

  const [mapsList, setMapsList] = useState([]);
  const [selectedMapId, setSelectedMapId] = useState(mapId || null);
  const [assetsList, setAssetsList] = useState([]);
  const [locationsList, setLocationsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados de edição / seleção
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isAddNodeModalOpen, setIsAddNodeModalOpen] = useState(false);
  const [isEditNodeModalOpen, setIsEditNodeModalOpen] = useState(false);
  const [isAddEdgeModalOpen, setIsAddEdgeModalOpen] = useState(false);
  const [isNewMapModalOpen, setIsNewMapModalOpen] = useState(false);
  const [isCloneMapModalOpen, setIsCloneMapModalOpen] = useState(false);
  const [cloneMapForm, setCloneMapForm] = useState({ name: "", description: "" });
  const [cloningMap, setCloningMap] = useState(false);
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState(false);

  // Estados para Áreas / Blocos de Agrupamento Dinâmicos (ex: Bloco ADM, Bloco UH)
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isNodeListOpen, setIsNodeListOpen] = useState(false);
  const [nodeSearchTerm, setNodeSearchTerm] = useState("");
  const [zoneForm, setZoneForm] = useState({
    id: null,
    label: "",
    color: "blue",
    selected_node_ids: [],
  });
  const [draggingZoneId, setDraggingZoneId] = useState(null);
  const [zoneDragStart, setZoneDragStart] = useState({ x: 0, y: 0, zoneX: 0, zoneY: 0, memberPositions: {} });

  const DEFAULT_DISPLAY_OPTIONS = {
    show_ip: true,
    unifi_metrics: ['cpu', 'ram', 'uptime', 'fw', 'wifi_experience', 'clients', 'channel_utilization', 'lan_experience', 'rx_tx']
  };

  const [newNodeForm, setNewNodeForm] = useState({
    asset_id: "",
    child_asset_ids: [],
    label: "",
    ip_address: "",
    icon_type: "Switch", // 'Switch', 'AccessPoint', 'Phone', 'Server', 'Firewall', 'Cloud', 'Rack', 'Zone'
    zone_id: "",
    width: "",
    height: "",
    sound_alert_offline: false,
    x: 400,
    y: 300,
    zabbix_selected_metrics: [],
    display_options: { ...DEFAULT_DISPLAY_OPTIONS },
    rack_display_options: { ...DEFAULT_DISPLAY_OPTIONS },
  });
  
  const [editNodeForm, setEditNodeForm] = useState({
    id: "",
    asset_id: "",
    child_asset_ids: [],
    label: "",
    ip_address: "",
    icon_type: "Switch",
    zone_id: "",
    width: "",
    height: "",
    sound_alert_offline: false,
    zabbix_selected_metrics: [],
    display_options: { ...DEFAULT_DISPLAY_OPTIONS },
    rack_display_options: { ...DEFAULT_DISPLAY_OPTIONS },
  });
  const [availableZabbixItems, setAvailableZabbixItems] = useState([]);
  const [selectedZabbixInterface, setSelectedZabbixInterface] = useState("");

  // Formulário para nova conexão e edição de conexão entre nós
  const [edgeEditId, setEdgeEditId] = useState(null);
  const [newEdgeForm, setNewEdgeForm] = useState({
    source_id: "",
    target_id: "",
    label: "",
  });

  // Formulário de novo mapa
  const [newMapForm, setNewMapForm] = useState({
    name: "",
    description: "",
    location_id: "",
  });

  // Dragging & Zoom / Pan state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Redimensionamento interativo de cards
  const [resizingNodeId, setResizingNodeId] = useState(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // Métricas ao vivo do Zabbix para exibir DENTRO dos cards
  const [liveMetrics, setLiveMetrics] = useState({});
  // Métricas do UniFi para exibir no painel de prevenção
  const [unifiMetrics, setUnifiMetrics] = useState([]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const audioCtxRef = useRef(null);

  // Carregar lista de mapas e ativos
  const fetchMaps = () => {
    api.get("/network-maps")
      .then((res) => {
        const list = res.data || [];
        setMapsList(list);
        if (!selectedMapId && list.length > 0) {
          setSelectedMapId(list[0].id);
        }
      })
      .catch(console.error);
  };

  const fetchAssetsAndLocations = () => {
    api.get("/assets")
      .then((res) => setAssetsList(res.data || []))
      .catch(console.error);

    api.get("/locations")
      .then((res) => setLocationsList(res.data || []))
      .catch(console.error);
  };

  // Carga do mapa (isFirstLoad = false não ativa tela cheia de loading para não piscar a TV)
  const fetchMapDetails = (id, isFirstLoad = true) => {
    if (!id) return;
    if (isFirstLoad) setLoading(true);
    api.get(`/network-maps/${id}`)
      .then((res) => {
        const latest = res.data;
        if (!latest) return;
        // Sanitiza nós para que nenhum fique com coordenadas negativas ou perdidas fora da tela
        const sanitizedNodes = (latest.nodes_data || []).map(n => {
          let updated = { ...n };
          if (typeof updated.x === 'number' && updated.x < 50) updated.x = 80;
          if (typeof updated.y === 'number' && updated.y < 50) updated.y = 80;
          return updated;
        });
        setMapData({ ...latest, nodes_data: sanitizedNodes });
        if (isFirstLoad) {
          // Prioridade 1: Cookies / LocalStorage específico desta TV ou navegador
          const savedViewport = getTvViewport(id);
          if (savedViewport && typeof savedViewport.zoom === 'number') {
            setZoom(savedViewport.zoom);
            if (savedViewport.pan && typeof savedViewport.pan.x === 'number') {
              setPan({ x: savedViewport.pan.x, y: savedViewport.pan.y });
            }
          } else {
            // Prioridade 2: Definições padrão salvas no banco de dados
            if (latest.zoom_level) setZoom(latest.zoom_level);
            if (latest.pan_x !== undefined && latest.pan_y !== undefined) {
              setPan({ x: latest.pan_x, y: latest.pan_y });
            }
          }
        }
        if (latest.assets_data && latest.assets_data.length > 0) {
          setAssetsList((prev) => {
            const map = new Map(prev.map(a => [a.id, a]));
            latest.assets_data.forEach(a => map.set(a.id, a));
            return Array.from(map.values());
          });
        }
        setHasUnsavedChanges(false);
        if (onMapLoaded) onMapLoaded(latest);
      })
      .catch(console.error)
      .finally(() => {
        if (isFirstLoad) setLoading(false);
      });
  };

  // Refresh periódico EM SEGUNDO PLANO
  const refreshMapStatuses = (id) => {
    if (!id || draggingNodeId || isPanning || resizingNodeId) return;

    // Se NÃO há alterações pendentes locais (ex: tela da TV ou monitor sem edição ativa),
    // puxa a versão completa do fluxograma silenciosamente.
    // Isso garante que se um nó for adicionado, movido, excluído ou editado em outro PC,
    // a TV atualiza automaticamente no countdown sem precisar de F5 ou acesso remoto!
    if (!hasUnsavedChanges) {
      fetchMapDetails(id, false);
      fetchLiveMetrics(id);
      return;
    }

    // Se o usuário estiver no meio de uma edição neste computador,
    // atualiza apenas os status de ICMP/Zabbix para não perder seu trabalho em andamento
    api.get(`/network-maps/${id}`)
      .then((res) => {
        const latestMap = res.data;
        if (!latestMap || !latestMap.nodes_data) return;

        const statusByAssetId = {};
        const statusByNodeId = {};
        latestMap.nodes_data.forEach((n) => {
          if (n.asset_id) statusByAssetId[n.asset_id] = n;
          if (n.id) statusByNodeId[n.id] = n;
        });

        // Atualizar status nos nós locais preservando posições (x, y) e edições pendentes
        setMapData((prev) => ({
          ...prev,
          nodes_data: prev.nodes_data.map((node) => {
            const updated = (node.asset_id && statusByAssetId[node.asset_id]) || statusByNodeId[node.id];
            if (updated) {
              return {
                ...node,
                icmp_status: updated.icmp_status,
                zabbix_status: updated.zabbix_status,
                zabbix_alert_title: updated.zabbix_alert_title,
                monitoring_protocol: updated.monitoring_protocol,
                ip_address: updated.ip_address || node.ip_address,
              };
            }
            return node;
          }),
        }));
      })
      .catch(console.error);
        
      fetchLiveMetrics(id);
    };

    const fetchLiveMetrics = async (mapId) => {
      // Fetch UniFi Preventative Metrics regardless of mapId
      try {
        const unifiRes = await api.get("/integrations/unifi/devices");
        if (unifiRes.data && unifiRes.data.devices) {
          setUnifiMetrics(unifiRes.data.devices);
        }
      } catch (e) {
        // silent fail if UniFi is not configured
      }

      if (!mapId) return; // Se não tem mapa selecionado, não busca métricas do zabbix

      try {
        const res = await api.get(`/network-maps/${mapId}`);
        const mapNodes = res.data.nodes_data || [];
        
        const assetsToFetch = mapNodes.filter(n => n.asset_id);
        const metricsMap = { ...liveMetrics };
        
        await Promise.all(assetsToFetch.map(async (node) => {
          try {
            const metricsRes = await api.get(`/zabbix/assets/${node.asset_id}/network-interfaces`);
            if (metricsRes.data && metricsRes.data.interfaces && metricsRes.data.interfaces.length > 0) {
              metricsMap[node.asset_id] = metricsRes.data.interfaces;
            }
          } catch (e) {
            // silent fail for nodes without metrics
          }
        }));
        setLiveMetrics(metricsMap);
      } catch (err) {
        console.error("Erro ao buscar métricas ao vivo", err);
      }
    };


  useEffect(() => {
    fetchMaps();
    fetchAssetsAndLocations();
  }, []);

  useEffect(() => {
    if (mapId) {
      const parsed = parseInt(mapId, 10);
      if (!isNaN(parsed) && parsed !== selectedMapId) {
        setSelectedMapId(parsed);
      }
    }
  }, [mapId]);

  useEffect(() => {
    if (selectedMapId) {
      const savedViewport = getTvViewport(selectedMapId);
      if (savedViewport && typeof savedViewport.zoom === 'number') {
        setZoom(savedViewport.zoom);
        if (savedViewport.pan && typeof savedViewport.pan.x === 'number') {
          setPan({ x: savedViewport.pan.x, y: savedViewport.pan.y });
        }
      }
      fetchMapDetails(selectedMapId, true);
      // Refresh automático em segundo plano a cada 15s (sem resetar posições ou arrasto do usuário)
      const interval = setInterval(() => refreshMapStatuses(selectedMapId), 15000);
      return () => clearInterval(interval);
    }
  }, [selectedMapId]);

  // Salvar resolução (zoom) e posicionamento (pan) em cookies/localStorage da TV automaticamente após ajustes
  useEffect(() => {
    if (!selectedMapId || isPanning) return;
    const timeout = setTimeout(() => {
      saveTvViewport(selectedMapId, zoom, pan);
    }, 400);
    return () => clearTimeout(timeout);
  }, [selectedMapId, zoom, pan, isPanning]);

  // Disparo de sincronização externa (acionado pelo countdown da tela pública/TV ou botão atualizar)
  useEffect(() => {
    if (refreshTrigger && selectedMapId && !draggingNodeId && !isPanning && !resizingNodeId && !hasUnsavedChanges) {
      fetchMapDetails(selectedMapId, false);
      fetchLiveMetrics(selectedMapId);
    }
  }, [refreshTrigger]);

  // Salvar mapa atual no backend (incluindo zoom e posição pan)
  const handleSaveMap = () => {
    if (!mapData.id) return;
    setSaving(true);
    saveTvViewport(mapData.id, zoom, pan);
    const payload = {
      name: mapData.name,
      description: mapData.description,
      nodes_data: mapData.nodes_data,
      edges_data: mapData.edges_data,
      zoom_level: zoom,
      pan_x: Math.round(pan.x),
      pan_y: Math.round(pan.y),
      background_image_url: mapData.background_image_url,
    };

    api.put(`/network-maps/${mapData.id}`, payload)
      .then((res) => {
        setMapData(res.data);
        setHasUnsavedChanges(false);
        alert("Topologia, zoom e enquadramento salvos com sucesso!");
      })
      .catch((err) => {
        console.error(err);
        alert("Erro ao salvar mapa.");
      })
      .finally(() => setSaving(false));
  };

  // Ajustar o diagrama para caber perfeitamente na tela do usuário/TV (incluindo telas 4K)
  const handleFitToScreen = () => {
    if (mapData.nodes_data.length === 0) return;
    
    // Calcular limites reais considerando a largura e altura de cada tipo de nó (especialmente Racks)
    const bounds = mapData.nodes_data.map(n => {
      if (n.icon_type === 'Zone') {
        const zb = getZoneBounds(n, mapData.nodes_data);
        return {
          minX: zb.x,
          maxX: zb.x + zb.width,
          minY: zb.y,
          maxY: zb.y + zb.height
        };
      }
      const dim = getNodeRealDimensions(n);
      return {
        minX: n.x,
        maxX: n.x + dim.w,
        minY: n.y,
        maxY: n.y + dim.h
      };
    });

    const minX = Math.min(...bounds.map(b => b.minX));
    const maxX = Math.max(...bounds.map(b => b.maxX));
    const minY = Math.min(...bounds.map(b => b.minY));
    const maxY = Math.max(...bounds.map(b => b.maxY));

    const mapWidth = Math.max(maxX - minX, 100);
    const mapHeight = Math.max(maxY - minY, 100);

    const container = containerRef.current;
    const cWidth = container ? container.clientWidth : (window.innerWidth || 1920);
    const cHeight = container ? container.clientHeight : (window.innerHeight - 130 || 900);

    const padding = 60;
    const availableW = Math.max(cWidth - padding * 2, 200);
    const availableH = Math.max(cHeight - padding * 2, 200);

    const scaleX = availableW / mapWidth;
    const scaleY = availableH / mapHeight;
    // Permite zoom de até 4.5x em telas grandes como TVs 4K
    const newZoom = Math.min(4.5, Math.max(0.2, Math.min(scaleX, scaleY)));

    const newPanX = (cWidth - mapWidth * newZoom) / 2 - minX * newZoom;
    const newPanY = (cHeight - mapHeight * newZoom) / 2 - minY * newZoom;

    const finalZoom = parseFloat(newZoom.toFixed(2));
    const finalPan = { x: Math.round(newPanX), y: Math.round(newPanY) };
    setZoom(finalZoom);
    setPan(finalPan);
    if (selectedMapId) {
      saveTvViewport(selectedMapId, finalZoom, finalPan);
    }
  };

  // Gerar Diagrama de Exemplo (Presets iguais à imagem fornecida)
  const handleSeedExampleMap = () => {
    const defaultNodes = [
      { id: "node_fw", asset_id: null,
    child_asset_ids: [], label: "Firewall Core", icon_type: "Firewall", x: 260, y: 320, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_algar", asset_id: null,
    child_asset_ids: [], label: "Provedor Algar Telecom", icon_type: "Cloud", x: 80, y: 220, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_mega", asset_id: null,
    child_asset_ids: [], label: "Provedor Mega Telecom", icon_type: "Cloud", x: 80, y: 110, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_tesa", asset_id: null,
    child_asset_ids: [], label: "Provedor TESA Link", icon_type: "Cloud", x: 80, y: 440, icmp_status: "online", zabbix_status: "ok" },
      
      { id: "node_sw_core", asset_id: null,
    child_asset_ids: [], label: "Switch_Core_Huawei", icon_type: "Switch", x: 520, y: 320, icmp_status: "online", zabbix_status: "ok" },
      
      // Access Points no topo
      { id: "node_ap1", asset_id: null,
    child_asset_ids: [], label: "AP-ALPHA-NOC", icon_type: "AccessPoint", x: 380, y: 110, icmp_status: "online", zabbix_status: "problem", zabbix_alert_title: "High error rate" },
      { id: "node_ap2", asset_id: null,
    child_asset_ids: [], label: "AP_SALA_REUNIAO", icon_type: "AccessPoint", x: 500, y: 110, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_ap3", asset_id: null,
    child_asset_ids: [], label: "AP-ALPHA-OFFICE", icon_type: "AccessPoint", x: 620, y: 110, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_ap4", asset_id: null,
    child_asset_ids: [], label: "AP-ALPHA-PRESIDENTE", icon_type: "AccessPoint", x: 740, y: 110, icmp_status: "online", zabbix_status: "ok" },

      // Switch Cisco com Alerta Vermelho
      { id: "node_sw_cisco", asset_id: null,
    child_asset_ids: [], label: "Switch_Cisco_Andar", icon_type: "Switch", x: 720, y: 380, icmp_status: "online", zabbix_status: "problem", zabbix_alert_title: "Link-down alert" },

      // Telefones IP à direita
      { id: "node_tel1", asset_id: null,
    child_asset_ids: [], label: "Telefone Pregão", icon_type: "Phone", x: 920, y: 130, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_tel2", asset_id: null,
    child_asset_ids: [], label: "Telefone Sala Reunião", icon_type: "Phone", x: 920, y: 220, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_tel3", asset_id: null,
    child_asset_ids: [], label: "Telefone Financeiro", icon_type: "Phone", x: 920, y: 310, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_tel4", asset_id: null,
    child_asset_ids: [], label: "Telefone RH", icon_type: "Phone", x: 920, y: 400, icmp_status: "online", zabbix_status: "ok" },

      // Servidores no rodapé
      { id: "node_srv_zabbix", asset_id: null,
    child_asset_ids: [], label: "Servidor Zabbix NOC", icon_type: "Server", x: 720, y: 550, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_videowall", asset_id: null,
    child_asset_ids: [], label: "VideoWall TV Controller", icon_type: "Server", x: 520, y: 550, icmp_status: "online", zabbix_status: "ok" },
    ];

    const defaultEdges = [
      { id: "e1", source_id: "node_algar", target_id: "node_fw", label: "WAN1 100M" },
      { id: "e2", source_id: "node_mega", target_id: "node_fw", label: "WAN2 500M" },
      { id: "e3", source_id: "node_tesa", target_id: "node_fw", label: "Link TESA" },
      { id: "e4", source_id: "node_fw", target_id: "node_sw_core", label: "Trunk GE0/0/1" },
      
      { id: "e5", source_id: "node_sw_core", target_id: "node_ap1", label: "GE1/0/4" },
      { id: "e6", source_id: "node_sw_core", target_id: "node_ap2", label: "GE1/0/6" },
      { id: "e7", source_id: "node_sw_core", target_id: "node_ap3", label: "GE2/0/8" },
      { id: "e8", source_id: "node_sw_core", target_id: "node_ap4", label: "GE2/0/1" },

      { id: "e9", source_id: "node_sw_core", target_id: "node_sw_cisco", label: "GE1/0/37 <-> GE1/0/37" },
      { id: "e10", source_id: "node_sw_core", target_id: "node_videowall", label: "GE2/0/20" },
      
      { id: "e11", source_id: "node_sw_cisco", target_id: "node_tel1", label: "GE1/0/13" },
      { id: "e12", source_id: "node_sw_cisco", target_id: "node_tel2", label: "GE1/0/11" },
      { id: "e13", source_id: "node_sw_cisco", target_id: "node_tel3", label: "GE1/0/25" },
      { id: "e14", source_id: "node_sw_cisco", target_id: "node_tel4", label: "GE1/0/12" },
      { id: "e15", source_id: "node_sw_cisco", target_id: "node_srv_zabbix", label: "GE1/0/1" },
    ];

    const payload = {
      name: "Topologia Geral de Rede TIHFSA",
      description: "Mapa de exemplo gerado automaticamente (Switches, APs, Telefones IP, Servidores)",
      is_default: true,
      nodes_data: defaultNodes,
      edges_data: defaultEdges,
    };

    api.post("/network-maps", payload)
      .then((res) => {
        fetchMaps();
        setSelectedMapId(res.data.id);
        alert("Topologia Exemplo gerada com sucesso!");
      })
      .catch(console.error);
  };

  // Excluir Fluxograma Inteiro
  const handleDeleteMap = () => {
    if (!mapData.id) return;
    if (!window.confirm(`Tem certeza que deseja excluir o fluxograma "${mapData.name}"?`)) return;

    api.delete(`/network-maps/${mapData.id}`)
      .then(() => {
        alert("Fluxograma excluído com sucesso.");
        fetchMaps();
        setSelectedMapId(null);
        setMapData({
          id: null,
          name: "",
          description: "",
          nodes_data: [],
          edges_data: [],
        });
      })
      .catch((err) => {
        console.error("Erro ao excluir fluxograma:", err);
        alert("Erro ao excluir o fluxograma.");
      });
  };

  // Gerar Fluxograma Automático a partir de Todos os Ativos Cadastrados no CMDB
  const handleAutoGenerateFromCMDB = () => {
    if (assetsList.length === 0) {
      alert("Nenhum ativo encontrado no CMDB para gerar a topologia.");
      return;
    }

    const firewalls = [];
    const switches = [];
    const accessPoints = [];
    const servers = [];
    const phones = [];
    const others = [];

    assetsList.forEach((asset) => {
      const typeLower = (asset.type || "").toLowerCase();
      const nameLower = (asset.name || "").toLowerCase();

      if (typeLower.includes("firewall") || typeLower.includes("router") || nameLower.includes("firewall") || nameLower.includes("borda")) {
        firewalls.push(asset);
      } else if (typeLower.includes("switch") || nameLower.includes("switch")) {
        switches.push(asset);
      } else if (typeLower.includes("access point") || typeLower.includes("antena") || typeLower.includes("wifi") || nameLower.includes("ap-") || nameLower.includes("ap_")) {
        accessPoints.push(asset);
      } else if (typeLower.includes("servidor") || typeLower.includes("server") || nameLower.includes("srv") || nameLower.includes("vm")) {
        servers.push(asset);
      } else if (typeLower.includes("telefone") || typeLower.includes("ramal") || nameLower.includes("tel") || nameLower.includes("phone")) {
        phones.push(asset);
      } else {
        others.push(asset);
      }
    });

    const generatedNodes = [];
    const generatedEdges = [];

    // TIER 1: Firewalls / Gateways WAN (Y = 100)
    const fwY = 100;
    const fwStartX = 280;
    const fwStepX = 220;
    firewalls.forEach((a, idx) => {
      generatedNodes.push({
        id: `node_asset_${a.id}`,
        asset_id: a.id,
        label: a.name,
        icon_type: "Firewall",
        x: fwStartX + idx * fwStepX,
        y: fwY,
        icmp_status: a.icmp_status || "online",
        zabbix_status: a.zabbix_status || "ok",
        zabbix_alert_title: a.zabbix_alert_title || null,
        ip_address: a.ip_address || "",
      });
    });

    if (firewalls.length === 0) {
      generatedNodes.push({
        id: "node_fw_virtual",
        asset_id: null,
    child_asset_ids: [],
        label: "Firewall Core / ISP",
        icon_type: "Firewall",
        x: 450,
        y: fwY,
        icmp_status: "online",
        zabbix_status: "ok",
        ip_address: "10.1.4.253",
      });
    }

    // TIER 2: Switches (Y = 280)
    const swY = 280;
    const swStartX = 220;
    const swStepX = 240;
    switches.forEach((a, idx) => {
      generatedNodes.push({
        id: `node_asset_${a.id}`,
        asset_id: a.id,
        label: a.name,
        icon_type: "Switch",
        x: swStartX + idx * swStepX,
        y: swY,
        icmp_status: a.icmp_status || "online",
        zabbix_status: a.zabbix_status || "ok",
        zabbix_alert_title: a.zabbix_alert_title || null,
        ip_address: a.ip_address || "",
      });

      const fwNodeId = firewalls.length > 0 ? `node_asset_${firewalls[0].id}` : "node_fw_virtual";
      generatedEdges.push({
        id: `edge_fw_sw_${a.id}`,
        source_id: fwNodeId,
        target_id: `node_asset_${a.id}`,
        label: "Trunk Link",
      });
    });

    const mainSwitchNodeId = switches.length > 0 ? `node_asset_${switches[0].id}` : "node_sw_core_virtual";
    if (switches.length === 0) {
      generatedNodes.push({
        id: mainSwitchNodeId,
        asset_id: null,
    child_asset_ids: [],
        label: "Switch Core Central",
        icon_type: "Switch",
        x: 450,
        y: swY,
        icmp_status: "online",
        zabbix_status: "ok",
      });
      const fwNodeId = firewalls.length > 0 ? `node_asset_${firewalls[0].id}` : "node_fw_virtual";
      generatedEdges.push({
        id: "edge_fw_sw_virt",
        source_id: fwNodeId,
        target_id: mainSwitchNodeId,
        label: "Trunk Core",
      });
    }

    // TIER 3: Access Points (Y = 460)
    const apY = 460;
    const apStartX = 120;
    const apStepX = 180;
    accessPoints.forEach((a, idx) => {
      const nodeId = `node_asset_${a.id}`;
      generatedNodes.push({
        id: nodeId,
        asset_id: a.id,
        label: a.name,
        icon_type: "AccessPoint",
        x: apStartX + (idx % 6) * apStepX,
        y: apY + Math.floor(idx / 6) * 140,
        icmp_status: a.icmp_status || "online",
        zabbix_status: a.zabbix_status || "ok",
        zabbix_alert_title: a.zabbix_alert_title || null,
        ip_address: a.ip_address || "",
      });
      generatedEdges.push({
        id: `edge_sw_ap_${a.id}`,
        source_id: mainSwitchNodeId,
        target_id: nodeId,
        label: `PoE Port ${idx + 1}`,
      });
    });

    // TIER 4: Servidores (Y = 640)
    const srvY = 640;
    const srvStartX = 150;
    const srvStepX = 200;
    servers.forEach((a, idx) => {
      const nodeId = `node_asset_${a.id}`;
      generatedNodes.push({
        id: nodeId,
        asset_id: a.id,
        label: a.name,
        icon_type: "Server",
        x: srvStartX + idx * srvStepX,
        y: srvY,
        icmp_status: a.icmp_status || "online",
        zabbix_status: a.zabbix_status || "ok",
        zabbix_alert_title: a.zabbix_alert_title || null,
        ip_address: a.ip_address || "",
      });
      generatedEdges.push({
        id: `edge_sw_srv_${a.id}`,
        source_id: mainSwitchNodeId,
        target_id: nodeId,
        label: `Port ${idx + 10}`,
      });
    });

    // TIER 5: Telefones IP (Y = 780)
    const telY = 780;
    const telStartX = 150;
    const telStepX = 180;
    phones.forEach((a, idx) => {
      const nodeId = `node_asset_${a.id}`;
      generatedNodes.push({
        id: nodeId,
        asset_id: a.id,
        label: a.name,
        icon_type: "Phone",
        x: telStartX + (idx % 6) * telStepX,
        y: telY + Math.floor(idx / 6) * 120,
        icmp_status: a.icmp_status || "online",
        zabbix_status: a.zabbix_status || "ok",
        zabbix_alert_title: a.zabbix_alert_title || null,
        ip_address: a.ip_address || "",
      });
      generatedEdges.push({
        id: `edge_sw_tel_${a.id}`,
        source_id: mainSwitchNodeId,
        target_id: nodeId,
        label: `VoIP Port ${idx + 1}`,
      });
    });

    // TIER 6: Outros Equipamentos (Desktops/Impressoras/etc)
    const othY = 920;
    const othStartX = 150;
    const othStepX = 180;
    others.forEach((a, idx) => {
      const nodeId = `node_asset_${a.id}`;
      generatedNodes.push({
        id: nodeId,
        asset_id: a.id,
        label: a.name,
        icon_type: "Server",
        x: othStartX + (idx % 6) * othStepX,
        y: othY + Math.floor(idx / 6) * 120,
        icmp_status: a.icmp_status || "online",
        zabbix_status: a.zabbix_status || "ok",
        zabbix_alert_title: a.zabbix_alert_title || null,
        ip_address: a.ip_address || "",
      });
      generatedEdges.push({
        id: `edge_sw_oth_${a.id}`,
        source_id: mainSwitchNodeId,
        target_id: nodeId,
        label: `LAN Port ${idx + 1}`,
      });
    });

    const payload = {
      name: `Topologia Automática CMDB (${assetsList.length} Ativos)`,
      description: "Gerado automaticamente a partir dos equipamentos ativos do CMDB",
      is_default: false,
      nodes_data: generatedNodes,
      edges_data: generatedEdges,
    };

    api.post("/network-maps", payload)
      .then((res) => {
        fetchMaps();
        setSelectedMapId(res.data.id);
        alert(`Topologia criada com sucesso com ${generatedNodes.length} ativos do CMDB!`);
      })
      .catch((err) => {
        console.error("Erro ao gerar topologia automática:", err);
        alert("Erro ao gerar topologia automática.");
      });
  };

  // Criar Novo Mapa
  const handleCreateNewMap = () => {
    if (!newMapForm.name) return;
    const payload = {
      name: newMapForm.name,
      description: newMapForm.description,
      location_id: newMapForm.location_id ? parseInt(newMapForm.location_id, 10) : null,
      nodes_data: [],
      edges_data: [],
    };

    api.post("/network-maps", payload)
      .then((res) => {
        setIsNewMapModalOpen(false);
        setNewMapForm({ name: "", description: "", location_id: "" });
        fetchMaps();
        setSelectedMapId(res.data.id);
      })
      .catch(console.error);
  };

  // Duplicar / Clonar Fluxograma
  const openCloneModal = () => {
    if (!mapData.id) return;
    setCloneMapForm({
      name: `${mapData.name} (Cópia)`,
      description: mapData.description || "",
    });
    setIsCloneMapModalOpen(true);
  };

  const handleCloneMap = () => {
    if (!mapData.id || !cloneMapForm.name.trim()) return;
    setCloningMap(true);
    api.post(`/network-maps/${mapData.id}/clone`, {
      name: cloneMapForm.name.trim(),
      description: cloneMapForm.description.trim() || undefined,
    })
      .then((res) => {
        setIsCloneMapModalOpen(false);
        fetchMaps();
        setSelectedMapId(res.data.id);
        if (onMapLoaded) onMapLoaded(res.data);
      })
      .catch((err) => {
        console.error("Erro ao clonar fluxograma:", err);
        alert(err.response?.data?.detail || "Erro ao clonar o fluxograma.");
      })
      .finally(() => {
        setCloningMap(false);
      });
  };

  // Handlers para Áreas / Blocos de Agrupamento
  // Foca e centraliza a tela diretamente em um nó ou área, selecionando-o
  const focusOnNode = (nodeId) => {
    const node = mapData.nodes_data.find(n => String(n.id) === String(nodeId));
    if (!node) return;

    setSelectedNodeId(node.id);

    const container = containerRef.current;
    const cWidth = container ? container.clientWidth : 1200;
    const cHeight = container ? container.clientHeight : 750;

    let targetX = Number(node.x) || 100;
    let targetY = Number(node.y) || 100;
    let targetW = node.width || (node.icon_type === 'Rack' ? 280 : 220);
    let targetH = node.height || 140;

    if (node.icon_type === 'Zone') {
      const zb = getZoneBounds(node, mapData.nodes_data);
      targetX = zb.x;
      targetY = zb.y;
      targetW = zb.width;
      targetH = zb.height;
    }

    if (targetX < 50) targetX = 80;
    if (targetY < 50) targetY = 80;

    const currentZoom = Math.max(0.6, Math.min(1.4, zoom));
    const newPanX = Math.round(cWidth / 2 - (targetX + targetW / 2) * currentZoom);
    const newPanY = Math.round(cHeight / 2 - (targetY + targetH / 2) * currentZoom);

    setPan({ x: newPanX, y: newPanY });
  };

  const openAddZoneModal = () => {
    setZoneForm({
      id: null,
      label: "",
      color: "blue",
      selected_node_ids: [],
    });
    setIsZoneModalOpen(true);
  };

  const openEditZoneModal = (zoneId) => {
    const zone = mapData.nodes_data.find(n => n.id === zoneId);
    if (!zone) return;
    const currentMembers = mapData.nodes_data
      .filter(n => n.zone_id === zone.id && n.id !== zone.id && n.icon_type !== 'Zone')
      .map(n => n.id);

    setZoneForm({
      id: zone.id,
      label: zone.label,
      color: zone.color || "blue",
      selected_node_ids: currentMembers,
    });
    setIsZoneModalOpen(true);
  };

  const handleSaveZone = async () => {
    if (!zoneForm.label.trim()) return;

    const isNew = !zoneForm.id;
    const zoneId = zoneForm.id || `zone_${Date.now()}`;

    const container = containerRef.current;
    const cWidth = container ? container.clientWidth : 1200;
    const cHeight = container ? container.clientHeight : 750;
    const centerX = (-pan.x + cWidth / 2) / zoom - 180;
    const centerY = (-pan.y + cHeight / 2) / zoom - 120;
    const safeX = Math.max(80, Math.min(3600, Math.round(centerX)));
    const safeY = Math.max(80, Math.min(2600, Math.round(centerY)));

    let updatedNodes = [...mapData.nodes_data];

    if (isNew) {
      const newZoneNode = {
        id: zoneId,
        label: zoneForm.label.trim(),
        icon_type: "Zone",
        color: zoneForm.color || "blue",
        x: safeX,
        y: safeY,
        width: 380,
        height: 240,
      };
      updatedNodes.push(newZoneNode);
    } else {
      updatedNodes = updatedNodes.map(n => {
        if (n.id === zoneId) {
          return {
            ...n,
            label: zoneForm.label.trim(),
            color: zoneForm.color || "blue",
          };
        }
        return n;
      });
    }

    // Atualiza pertinência exclusiva:
    // Nós em selected_node_ids recebem zone_id = zoneId (desvincula de qualquer outra zona)
    // Nós que tinham zone_id === zoneId mas foram desmarcados recebem zone_id = null
    updatedNodes = updatedNodes.map(n => {
      if (n.id === zoneId || n.icon_type === 'Zone') return n;
      const isSelected = zoneForm.selected_node_ids.includes(n.id);
      if (isSelected) {
        return { ...n, zone_id: zoneId };
      } else if (n.zone_id === zoneId) {
        return { ...n, zone_id: null };
      }
      return n;
    });

    setMapData(prev => ({
      ...prev,
      nodes_data: updatedNodes,
    }));
    setIsZoneModalOpen(false);

    if (mapData.id) {
      try {
        const payload = {
          name: mapData.name,
          description: mapData.description,
          nodes_data: updatedNodes,
          edges_data: mapData.edges_data,
          zoom_level: zoom,
          pan_x: Math.round(pan.x),
          pan_y: Math.round(pan.y),
          background_image_url: mapData.background_image_url,
        };
        const res = await api.put(`/network-maps/${mapData.id}`, payload);
        if (res.data) {
          setMapData(res.data);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Erro ao salvar área/bloco:", err);
      }
    }
  };

  const handleDeleteZone = async (zoneId) => {
    const zone = mapData.nodes_data.find(n => n.id === zoneId);
    if (!zone) return;
    if (!window.confirm(`Tem certeza que deseja remover a área "${zone.label}"? Os equipamentos pertencentes não serão excluídos, apenas desvinculados.`)) return;

    const updatedNodes = mapData.nodes_data
      .filter(n => n.id !== zoneId)
      .map(n => n.zone_id === zoneId ? { ...n, zone_id: null } : n);

    setMapData(prev => ({
      ...prev,
      nodes_data: updatedNodes,
    }));

    if (mapData.id) {
      try {
        const payload = {
          name: mapData.name,
          description: mapData.description,
          nodes_data: updatedNodes,
          edges_data: mapData.edges_data,
          zoom_level: zoom,
          pan_x: Math.round(pan.x),
          pan_y: Math.round(pan.y),
          background_image_url: mapData.background_image_url,
        };
        const res = await api.put(`/network-maps/${mapData.id}`, payload);
        if (res.data) {
          setMapData(res.data);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Erro ao remover área:", err);
      }
    }
  };

  const handleMouseDownZone = (zoneId, e) => {
    if (isPublicView) return;
    e.stopPropagation();
    setDraggingZoneId(zoneId);
    setSelectedNodeId(zoneId);

    const zone = mapData.nodes_data.find(n => n.id === zoneId);
    const members = mapData.nodes_data.filter(n => n.zone_id === zoneId && n.id !== zoneId && n.icon_type !== 'Zone');

    const memberPositions = {};
    members.forEach(m => {
      memberPositions[m.id] = { x: m.x, y: m.y };
    });

    setZoneDragStart({
      x: e.clientX,
      y: e.clientY,
      zoneX: zone?.x || 0,
      zoneY: zone?.y || 0,
      memberPositions,
    });
  };

  // Adicionar Nó ao Mapa
  const handleAddNode = async () => {
    const selectedAsset = assetsList.find(a => String(a.id) === String(newNodeForm.asset_id));
    
    // Calcula o centro da tela atual baseado no pan e zoom
    const container = containerRef.current;
    const cWidth = container ? container.clientWidth : 1200;
    const cHeight = container ? container.clientHeight : 750;
    const centerX = (-pan.x + cWidth / 2) / zoom - 60;
    const centerY = (-pan.y + cHeight / 2) / zoom - 45;
    const safeX = Math.max(80, Math.min(3600, Math.round(centerX)));
    const safeY = Math.max(80, Math.min(2600, Math.round(centerY)));

    const displayOpts = newNodeForm.display_options || newNodeForm.rack_display_options || DEFAULT_DISPLAY_OPTIONS;

    const newNode = {
      id: `node_${Date.now()}`,
      asset_id: selectedAsset ? selectedAsset.id : null,
      label: newNodeForm.label || (selectedAsset ? selectedAsset.name : "Novo Equipamento"),
      icon_type: newNodeForm.icon_type,
      zone_id: newNodeForm.zone_id || null,
      x: safeX,
      y: safeY,
      width: newNodeForm.width ? parseInt(newNodeForm.width, 10) : null,
      height: newNodeForm.height ? parseInt(newNodeForm.height, 10) : null,
      sound_alert_offline: !!newNodeForm.sound_alert_offline,
      icmp_status: selectedAsset ? selectedAsset.icmp_status : "online",
      zabbix_status: selectedAsset ? selectedAsset.zabbix_status : "ok",
      zabbix_alert_title: selectedAsset ? selectedAsset.zabbix_alert_title : null,
      ip_address: newNodeForm.ip_address || (selectedAsset ? selectedAsset.ip_address : ""),
      zabbix_selected_metrics: [...newNodeForm.zabbix_selected_metrics],
      child_asset_ids: newNodeForm.child_asset_ids || [],
      display_options: displayOpts,
      rack_display_options: displayOpts
    };

    const updatedNodes = [...mapData.nodes_data, newNode];
    setMapData((prev) => ({
      ...prev,
      nodes_data: updatedNodes,
    }));

    setIsAddNodeModalOpen(false);
    setNewNodeForm({ 
      asset_id: "", 
      child_asset_ids: [], 
      label: "", 
      ip_address: "", 
      icon_type: "Switch", 
      zone_id: "",
      width: "", 
      height: "", 
      sound_alert_offline: false,
      x: 400, 
      y: 300, 
      zabbix_selected_metrics: [],
      display_options: { ...DEFAULT_DISPLAY_OPTIONS },
      rack_display_options: { ...DEFAULT_DISPLAY_OPTIONS }
    });
    setAvailableZabbixItems([]);
    setSelectedZabbixInterface("");

    if (mapData.id) {
      try {
        const payload = {
          name: mapData.name,
          description: mapData.description,
          nodes_data: updatedNodes,
          edges_data: mapData.edges_data,
          zoom_level: zoom,
          pan_x: Math.round(pan.x),
          pan_y: Math.round(pan.y),
          background_image_url: mapData.background_image_url,
        };
        const res = await api.put(`/network-maps/${mapData.id}`, payload);
        if (res.data) {
          setMapData(res.data);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Erro ao salvar novo nó no mapa:", err);
      }
    }
  };

  // Abrir Modal de Edição de Nó
  const openEditNodeModal = async (nodeId) => {
    const node = mapData.nodes_data.find(n => String(n.id) === String(nodeId));
    if (!node) return;
    if (node.icon_type === 'Zone') {
      openEditZoneModal(node.id);
      return;
    }
    
    const existingOpts = {
      show_ip: node.display_options?.show_ip ?? node.rack_display_options?.show_ip ?? true,
      unifi_metrics: Array.isArray(node.display_options?.unifi_metrics)
        ? [...node.display_options.unifi_metrics]
        : (Array.isArray(node.rack_display_options?.unifi_metrics)
        ? [...node.rack_display_options.unifi_metrics]
        : [...DEFAULT_DISPLAY_OPTIONS.unifi_metrics])
    };

    setEditNodeForm({
      id: node.id,
      asset_id: node.asset_id ? String(node.asset_id) : "",
      label: node.label,
      icon_type: node.icon_type,
      zone_id: node.zone_id || "",
      ip_address: node.ip_address || "",
      width: node.width !== undefined && node.width !== null ? String(node.width) : "",
      height: node.height !== undefined && node.height !== null ? String(node.height) : "",
      sound_alert_offline: !!node.sound_alert_offline,
      zabbix_selected_metrics: Array.isArray(node.zabbix_selected_metrics) ? [...node.zabbix_selected_metrics] : [],
      child_asset_ids: Array.isArray(node.child_asset_ids) ? [...node.child_asset_ids] : [],
      display_options: existingOpts,
      rack_display_options: existingOpts
    });
    setAvailableZabbixItems([]);
    setSelectedZabbixInterface("");

    if (node.asset_id) {
      const selected = assetsList.find(a => String(a.id) === String(node.asset_id));
      if (selected && selected.zabbix_items) {
        setAvailableZabbixItems(selected.zabbix_items);
        const interfaces = Array.from(new Set(selected.zabbix_items.map(i => i.interface_name).filter(Boolean)));
        let initialInterface = "";
        if (node.zabbix_selected_metrics && node.zabbix_selected_metrics.length > 0) {
          const firstChecked = selected.zabbix_items.find(i => node.zabbix_selected_metrics.some(m => (typeof m === 'string' ? m : m.name) === i.name));
          if (firstChecked && firstChecked.interface_name) {
            initialInterface = firstChecked.interface_name;
          }
        }
        
        if (!initialInterface && interfaces.length > 0) {
          initialInterface = interfaces[0];
        }
        
        setSelectedZabbixInterface(initialInterface);
      }
    }
    
    setIsEditNodeModalOpen(true);
  };

  // Salvar Edição do Nó
  const handleSaveEditNode = async () => {
    const selectedAsset = assetsList.find(a => String(a.id) === editNodeForm.asset_id);
    const displayOpts = {
      show_ip: editNodeForm.display_options?.show_ip ?? true,
      unifi_metrics: Array.isArray(editNodeForm.display_options?.unifi_metrics)
        ? [...editNodeForm.display_options.unifi_metrics]
        : (Array.isArray(editNodeForm.rack_display_options?.unifi_metrics)
        ? [...editNodeForm.rack_display_options.unifi_metrics]
        : [...DEFAULT_DISPLAY_OPTIONS.unifi_metrics])
    };
    
    const updatedNodes = mapData.nodes_data.map(n => {
      if (n.id === editNodeForm.id) {
        return {
          ...n,
          asset_id: selectedAsset ? selectedAsset.id : null,
          child_asset_ids: editNodeForm.child_asset_ids || [],
          width: editNodeForm.width ? parseInt(editNodeForm.width, 10) : null,
          height: editNodeForm.height ? parseInt(editNodeForm.height, 10) : null,
          sound_alert_offline: !!editNodeForm.sound_alert_offline,
          display_options: displayOpts,
          rack_display_options: displayOpts,
          label: editNodeForm.label || (selectedAsset ? selectedAsset.name : n.label),
          icon_type: editNodeForm.icon_type,
          zone_id: editNodeForm.zone_id || null,
          ip_address: editNodeForm.ip_address || (selectedAsset ? selectedAsset.ip_address : n.ip_address),
          zabbix_selected_metrics: [...editNodeForm.zabbix_selected_metrics],
          icmp_status: selectedAsset ? selectedAsset.icmp_status : n.icmp_status,
          zabbix_status: selectedAsset ? selectedAsset.zabbix_status : n.zabbix_status,
          zabbix_alert_title: selectedAsset ? selectedAsset.zabbix_alert_title : n.zabbix_alert_title,
        };
      }
      return n;
    });

    setMapData(prev => ({
      ...prev,
      nodes_data: updatedNodes,
    }));
    
    setIsEditNodeModalOpen(false);
    setAvailableZabbixItems([]);
    setSelectedZabbixInterface("");

    // PERSISTÊNCIA DIRETA NO BACKEND:
    // Salva imediatamente no banco de dados para garantir que as alterações não sejam perdidas
    // e o countdown da TV já carregue as opções atualizadas no próximo ciclo!
    if (mapData.id) {
      try {
        const payload = {
          name: mapData.name,
          description: mapData.description,
          nodes_data: updatedNodes,
          edges_data: mapData.edges_data,
          zoom_level: zoom,
          pan_x: Math.round(pan.x),
          pan_y: Math.round(pan.y),
          background_image_url: mapData.background_image_url,
        };
        const res = await api.put(`/network-maps/${mapData.id}`, payload);
        if (res.data) {
          setMapData(res.data);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Erro ao salvar alterações do nó:", err);
      }
    }
  };

  // Abrir Modal de Conexão em Modo Edição
  const openEditEdgeModal = (edgeId) => {
    const edge = mapData.edges_data.find(e => e.id === edgeId);
    if (!edge) return;
    setEdgeEditId(edge.id);
    setNewEdgeForm({
      source_id: edge.source_id,
      target_id: edge.target_id,
      label: edge.label || "",
    });
    setIsAddEdgeModalOpen(true);
  };

  // Abrir Modal de Conectar Nós no modo Edição para o Nó selecionado
  const handleOpenEditNodeConnection = (nodeId) => {
    const nodeEdges = mapData.edges_data.filter(
      e => String(e.source_id) === String(nodeId) || String(e.target_id) === String(nodeId)
    );

    if (nodeEdges.length > 0) {
      // Abre a primeira conexão deste nó no modo edição
      const edge = nodeEdges[0];
      setEdgeEditId(edge.id);
      setNewEdgeForm({
        source_id: edge.source_id,
        target_id: edge.target_id,
        label: edge.label || "",
      });
    } else {
      // Se ainda não tiver conexão, abre para conectar a partir deste nó
      setEdgeEditId(null);
      setNewEdgeForm({
        source_id: nodeId,
        target_id: "",
        label: "",
      });
    }
    setIsAddEdgeModalOpen(true);
  };

  // Salvar Conexão entre Nós (Criação ou Edição) com persistência imediata
  const handleSaveEdge = async () => {
    if (!newEdgeForm.source_id || !newEdgeForm.target_id) {
      alert("Selecione o Nó Origem e o Nó Destino.");
      return;
    }
    if (newEdgeForm.source_id === newEdgeForm.target_id) {
      alert("O Nó Origem e o Nó Destino devem ser diferentes.");
      return;
    }

    let updatedEdges;
    if (edgeEditId) {
      updatedEdges = mapData.edges_data.map(e => {
        if (e.id === edgeEditId) {
          return {
            ...e,
            source_id: newEdgeForm.source_id,
            target_id: newEdgeForm.target_id,
            label: newEdgeForm.label.trim(),
          };
        }
        return e;
      });
    } else {
      const newEdge = {
        id: `edge_${Date.now()}`,
        source_id: newEdgeForm.source_id,
        target_id: newEdgeForm.target_id,
        label: newEdgeForm.label.trim(),
      };
      updatedEdges = [...mapData.edges_data, newEdge];
    }

    setMapData(prev => ({
      ...prev,
      edges_data: updatedEdges,
    }));

    setIsAddEdgeModalOpen(false);
    setEdgeEditId(null);
    setNewEdgeForm({ source_id: "", target_id: "", label: "" });

    // Persistência imediata no backend
    if (mapData.id) {
      try {
        const payload = {
          name: mapData.name,
          description: mapData.description,
          nodes_data: mapData.nodes_data,
          edges_data: updatedEdges,
          zoom_level: zoom,
          pan_x: Math.round(pan.x),
          pan_y: Math.round(pan.y),
          background_image_url: mapData.background_image_url,
        };
        const res = await api.put(`/network-maps/${mapData.id}`, payload);
        if (res.data) {
          setMapData(res.data);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Erro ao salvar conexão:", err);
      }
    }
  };

  // Excluir Conexão entre Nós
  const handleDeleteEdge = async () => {
    if (!edgeEditId) return;
    const updatedEdges = mapData.edges_data.filter(e => e.id !== edgeEditId);
    setMapData(prev => ({
      ...prev,
      edges_data: updatedEdges,
    }));

    setIsAddEdgeModalOpen(false);
    setEdgeEditId(null);
    setNewEdgeForm({ source_id: "", target_id: "", label: "" });

    if (mapData.id) {
      try {
        const payload = {
          name: mapData.name,
          description: mapData.description,
          nodes_data: mapData.nodes_data,
          edges_data: updatedEdges,
          zoom_level: zoom,
          pan_x: Math.round(pan.x),
          pan_y: Math.round(pan.y),
          background_image_url: mapData.background_image_url,
        };
        const res = await api.put(`/network-maps/${mapData.id}`, payload);
        if (res.data) {
          setMapData(res.data);
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Erro ao excluir conexão:", err);
      }
    }
  };

  // Remover Nó Selecionado
  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setMapData((prev) => ({
      ...prev,
      nodes_data: prev.nodes_data
        .filter((n) => n.id !== selectedNodeId)
        .map((n) => n.zone_id === selectedNodeId ? { ...n, zone_id: null } : n),
      edges_data: prev.edges_data.filter((e) => e.source_id !== selectedNodeId && e.target_id !== selectedNodeId),
    }));
    setSelectedNodeId(null);
  };

  // Eventos de Mouse, Zoom e Navegação Panorâmica no Canvas
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => parseFloat(Math.min(5.0, Math.max(0.2, prev + delta)).toFixed(2)));
  };

  const handleCanvasMouseDown = (e) => {
    setSelectedNodeId(null);
    setIsNodeListOpen(false);
    if (e.target === containerRef.current || isPanMode || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseDownNode = (nodeId, e) => {
    if (isPublicView || isPanMode) return;
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setDraggingNodeId(nodeId);
    
    const node = mapData.nodes_data.find(n => n.id === nodeId);
    if (node) {
      setDragOffset({
        x: (e.clientX - pan.x) / zoom - node.x,
        y: (e.clientY - pan.y) / zoom - node.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (resizingNodeId) {
      const diffX = Math.round((e.clientX - resizeStart.x) / zoom);
      const diffY = Math.round((e.clientY - resizeStart.y) / zoom);
      const newW = Math.max(160, Math.min(900, resizeStart.w + diffX));
      const newH = resizeStart.h ? Math.max(80, Math.min(1400, resizeStart.h + diffY)) : (diffY > 15 ? Math.max(80, diffY + 120) : null);

      setHasUnsavedChanges(true);
      setMapData((prev) => ({
        ...prev,
        nodes_data: prev.nodes_data.map((n) => 
          n.id === resizingNodeId ? { ...n, width: newW, height: newH } : n
        ),
      }));
      return;
    }

    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingZoneId) {
      const diffX = Math.round((e.clientX - zoneDragStart.x) / zoom);
      const diffY = Math.round((e.clientY - zoneDragStart.y) / zoom);

      setHasUnsavedChanges(true);
      setMapData((prev) => ({
        ...prev,
        nodes_data: prev.nodes_data.map((n) => {
          if (n.id === draggingZoneId) {
            return {
              ...n,
              x: zoneDragStart.zoneX + diffX,
              y: zoneDragStart.zoneY + diffY,
            };
          }
          if (zoneDragStart.memberPositions[n.id]) {
            return {
              ...n,
              x: zoneDragStart.memberPositions[n.id].x + diffX,
              y: zoneDragStart.memberPositions[n.id].y + diffY,
            };
          }
          return n;
        }),
      }));
      return;
    }

    if (!draggingNodeId || isPublicView) return;
    
    const newX = Math.round((e.clientX - pan.x) / zoom - dragOffset.x);
    const newY = Math.round((e.clientY - pan.y) / zoom - dragOffset.y);

    setHasUnsavedChanges(true);
    setMapData((prev) => ({
      ...prev,
      nodes_data: prev.nodes_data.map((n) => 
        n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n
      ),
    }));
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    setDraggingZoneId(null);
    setIsPanning(false);
    setResizingNodeId(null);
  };

  // Renderizar Ícones dos Equipamentos no Nó
  const renderNodeIcon = (iconType, isProblem, isOffline) => {
    const iconColor = isOffline || isProblem ? "text-red-400" : "text-emerald-400";

    switch (iconType) {
      case "Switch":
        return <HardDrive size={28} className={iconColor} />;
      case "AccessPoint":
        return <Wifi size={28} className={iconColor} />;
      case "Phone":
        return <Phone size={26} className={iconColor} />;
      case "Firewall":
        return <Shield size={28} className={iconColor} />;
      case "Cloud":
        return <Cloud size={28} className="text-blue-400" />;
      default:
        return <Server size={28} className={iconColor} />;
    }
  };

  // Determina se o Nó (ou qualquer um de seus filhos) está offline
  const getIsNodeOffline = (node) => {
    if (node.icmp_status === "offline") return true;
    if (node.ip_address) {
      const u = unifiMetrics.find(um => um.ip === node.ip_address);
      if (u && u.state === 0) return true;
    }
    if (node.child_asset_ids && node.child_asset_ids.length > 0) {
      for (const cid of node.child_asset_ids) {
        const childAsset = assetsList.find(a => String(a.id) === String(cid));
        if (childAsset) {
          if (childAsset.icmp_status === "offline") return true;
          if (childAsset.ip_address) {
            const uc = unifiMetrics.find(um => um.ip === childAsset.ip_address);
            if (uc && uc.state === 0) return true;
          }
        }
      }
    }
    return false;
  };

  // Verifica se o nó específico possui alerta sonoro e está offline (configurado no fluxograma)
  const getIsNodeSoundAlertTriggered = (node) => {
    if (!node.sound_alert_offline) return false;
    
    // 1. Status do próprio nó
    const isThisNodeOffline = node.icmp_status === "offline" || (node.ip_address && unifiMetrics.some(um => um.ip === node.ip_address && um.state === 0));
    if (isThisNodeOffline) return true;

    // 2. Se for Rack ou Zone com alerta ativado, checa os dispositivos contidos nele
    if (node.child_asset_ids && node.child_asset_ids.length > 0) {
      for (const cid of node.child_asset_ids) {
        const childAsset = assetsList.find(a => String(a.id) === String(cid));
        if (childAsset) {
          const isChildOffline = childAsset.icmp_status === "offline" || (childAsset.ip_address && unifiMetrics.some(um => um.ip === childAsset.ip_address && um.state === 0));
          if (isChildOffline) return true;
        }
      }
    }

    return false;
  };

  // Síntese de áudio suave para NOC (Web Audio API: tom D5 -> A5 sutil com decaimento exponencial)
  const playGentleNocChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.18, now);
      masterGain.connect(ctx.destination);

      // Tom 1: 587.33 Hz (D5) - toque macio inicial (80ms)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.01, now);
      gain1.gain.exponentialRampToValueAtTime(0.18, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.13);

      // Tom 2: 880 Hz (A5) - sino suave de atenção NOC (250ms)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.08);
      gain2.gain.setValueAtTime(0.01, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.22, now + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.36);
    } catch (err) {
      console.warn("[NOC Sound Alert]", err);
    }
  };

  // Desbloqueia AudioContext no primeiro clique/interação na janela (política de autoplay do browser)
  useEffect(() => {
    const unlockAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  // Alerta sonoro intercalado a cada 2 segundos quando houver equipamento com alerta offline
  useEffect(() => {
    if (isAudioMuted) return;

    const interval = setInterval(() => {
      const hasTriggered = (mapData.nodes_data || []).some(n => getIsNodeSoundAlertTriggered(n));
      if (hasTriggered) {
        playGentleNocChime();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [mapData.nodes_data, assetsList, unifiMetrics, isAudioMuted]);

  const hasAnySoundAlertTriggered = (mapData.nodes_data || []).some(n => getIsNodeSoundAlertTriggered(n));
  const soundAlertsActiveCount = (mapData.nodes_data || []).filter(n => n.sound_alert_offline).length;

  return (
    <div className="space-y-4 flex-1 flex flex-col w-full h-full min-h-0">
      
      {/* Dynamic Header & Controls (Visível apenas na Administração) */}
      {!isPublicView && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Seletor de Diagrama / Mapa */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Activity size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMapId || ""}
                  onChange={(e) => setSelectedMapId(parseInt(e.target.value, 10))}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-black text-white outline-none focus:border-blue-500 cursor-pointer"
                >
                  {mapsList.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsNewMapModalOpen(true)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="Criar Novo Mapa de Topologia em Branco"
                >
                  <Plus size={14} />
                </button>
                <button
                  onClick={openCloneModal}
                  disabled={!mapData.id}
                  className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Duplicar / Clonar este fluxograma (preserva racks, switches e conexões com novo nome)"
                >
                  <Copy size={13} />
                  <span>Clonar</span>
                </button>
              </div>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">
                {mapData.description || "Desenhe e monitore diagramas de rede em tempo real"}
              </p>
            </div>
          </div>

          {/* Botões de Ação do Construtor */}
          <div className="flex flex-wrap items-center gap-2">
            
            <button
              onClick={handleAutoGenerateFromCMDB}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              title="Criar novo diagrama conectando automaticamente os ativos do CMDB"
            >
              <Zap size={15} />
              <span>Gerar Automático (do CMDB)</span>
            </button>

            {mapsList.length === 0 && (
              <button
                onClick={handleSeedExampleMap}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>🪄 Modelo Exemplo</span>
              </button>
            )}

            {/* 1. Adicionar Equipamento */}
            <button
              onClick={() => setIsAddNodeModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Adicionar um novo equipamento (Switch, AP, Servidor, Rack...)"
            >
              <Plus size={15} /> Adicionar Equipamento
            </button>

            {/* 2. Nova Área / Bloco */}
            <button
              onClick={openAddZoneModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/20"
              title="Criar uma Área / Bloco para agrupar e delimitar equipamentos (ex: Bloco ADM, Bloco UH)"
            >
              <Layers size={15} /> Nova Área / Bloco
            </button>

            {/* 3. Conectar Nós (Cabos) */}
            <button
              onClick={() => {
                setEdgeEditId(null);
                setNewEdgeForm({
                  source_id: selectedNodeId || "",
                  target_id: "",
                  label: "",
                });
                setIsAddEdgeModalOpen(true);
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Criar conexão de cabo entre dois equipamentos"
            >
              <LinkIcon size={15} /> Conectar Nós (Cabos)
            </button>

            {/* 4. Editar Nó / Editar Área (conforme os demais botões da barra) */}
            {(() => {
              const selectedNode = mapData.nodes_data.find(n => String(n.id) === String(selectedNodeId));
              const isZone = selectedNode && selectedNode.icon_type === 'Zone';

              if (selectedNode) {
                return (
                  <button
                    onClick={() => {
                      if (isZone) {
                        openEditZoneModal(selectedNode.id);
                      } else {
                        handleOpenEditNodeConnection(selectedNode.id);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/30"
                    title={isZone ? `Editar nome da área: ${selectedNode.label}` : `Editar nome e configurações do nó: ${selectedNode.label}`}
                  >
                    <Edit3 size={15} /> {isZone ? "Editar Área" : "Editar Nó"}
                  </button>
                );
              }

              return (
                <button
                  onClick={() => alert("Clique em um equipamento ou área no mapa para selecioná-lo e depois clique em Editar Nó.")}
                  className="bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Clique em um equipamento no mapa para selecionar e editar seu nome"
                >
                  <Edit3 size={15} /> Editar Nó
                </button>
              );
            })()}

            {/* 5. Excluir Nó / Área */}
            {(() => {
              const selectedNode = mapData.nodes_data.find(n => String(n.id) === String(selectedNodeId));
              const isZone = selectedNode && selectedNode.icon_type === 'Zone';

              if (selectedNode) {
                return (
                  <button
                    onClick={() => {
                      if (isZone) {
                        handleDeleteZone(selectedNode.id);
                      } else {
                        handleDeleteSelectedNode();
                      }
                    }}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-red-500/30"
                    title={isZone ? `Excluir área: ${selectedNode.label}` : `Excluir equipamento: ${selectedNode.label}`}
                  >
                    <Trash2 size={15} /> {isZone ? "Excluir Área" : "Excluir Nó"}
                  </button>
                );
              }

              return null;
            })()}


            {hasUnsavedChanges && (
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl text-xs font-black animate-pulse flex items-center gap-1">
                ⚠️ Alterações pendentes
              </span>
            )}

            <button
              onClick={handleSaveMap}
              disabled={saving || !mapData.id}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                hasUnsavedChanges
                  ? "bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold ring-2 ring-amber-400/50"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              <Save size={15} className={saving ? "animate-spin" : ""} />
              <span>{saving ? "Salvando..." : "Salvar Mapa"}</span>
            </button>

            {mapData.id && (
              <button
                onClick={handleDeleteMap}
                className="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-red-600/30"
                title="Excluir este fluxograma completo"
              >
                <Trash2 size={14} /> Excluir Fluxograma
              </button>
            )}

            <a
              href={`/noc?view=map&map_id=${selectedMapId || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
              title="Abrir este mapa em tela cheia para TV"
            >
              <Maximize2 size={14} className="text-blue-400" /> Transmitir em TV
            </a>
          </div>

        </div>
      )}

      {/* Interactive Topology Canvas Container */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`bg-slate-950 border border-slate-900 rounded-3xl relative overflow-hidden shadow-2xl select-none flex-1 w-full ${
          isPublicView 
            ? "h-[calc(100vh-130px)] min-h-[600px]" 
            : "h-[calc(100vh-230px)] min-h-[720px]"
        } ${
          isPanMode ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        {/* Badge Flutuante de Identificação do Fluxograma (Canto Superior Esquerdo) */}
        {mapData.name && (
          <div className="absolute top-4 left-4 z-40 pointer-events-none flex flex-col gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 px-4 py-2.5 rounded-2xl shadow-2xl max-w-md select-none transition-all duration-300">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <h2 className="text-xs sm:text-sm font-black text-white tracking-wide uppercase truncate" title={mapData.name}>
                {mapData.name}
              </h2>
            </div>
            {mapData.description && (
              <p className="text-[11px] text-slate-400 font-medium line-clamp-1" title={mapData.description}>
                {mapData.description}
              </p>
            )}
          </div>
        )}
        
        {/* Floating Zoom & Pan Control Bar (Bottom Right) */}
        <div className="absolute bottom-4 right-4 z-40 bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 backdrop-blur-md shadow-2xl flex items-center gap-1.5 text-slate-300 text-xs">
          
          <button
            onClick={() => setZoom(prev => parseFloat(Math.min(5.0, prev + 0.15).toFixed(2)))}
            className="p-2 hover:bg-slate-800 rounded-xl transition-all font-bold cursor-pointer text-slate-200"
            title="Aumentar Zoom (+)"
          >
            <ZoomIn size={16} />
          </button>

          <span className="font-mono font-bold text-white px-2 min-w-[46px] text-center text-xs">
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={() => setZoom(prev => parseFloat(Math.max(0.2, prev - 0.15).toFixed(2)))}
            className="p-2 hover:bg-slate-800 rounded-xl transition-all font-bold cursor-pointer text-slate-200"
            title="Diminuir Zoom (-)"
          >
            <ZoomOut size={16} />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1" />

          <button
            onClick={() => { setZoom(1.0); setPan({ x: 0, y: 0 }); }}
            className="px-2.5 py-1.5 hover:bg-slate-800 rounded-xl text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1 text-slate-300"
            title="Restaurar para 100%"
          >
            <RotateCcw size={13} /> 100%
          </button>

          <button
            onClick={handleFitToScreen}
            className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1"
            title="Ajustar automaticamente todos os equipamentos para caber na tela"
          >
            <Maximize2 size={13} /> Fit Tela
          </button>

          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.();
              } else {
                document.exitFullscreen?.();
              }
            }}
            className="p-2 hover:bg-slate-800 rounded-xl transition-all font-bold cursor-pointer text-slate-300 hover:text-white"
            title="Alternar Tela Cheia (F11)"
          >
            <Maximize2 size={16} />
          </button>

          {!isPublicView && (
            <button
              onClick={() => setIsPanMode(!isPanMode)}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
                isPanMode ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30" : "hover:bg-slate-800 text-slate-400"
              }`}
              title="Modo Arrastar Tela (Panorâmica)"
            >
              <Hand size={14} /> Mover Tela
            </button>
          )}

          {/* Sound Alert Toggle / Indicator */}
          <div className="h-4 w-px bg-slate-800 mx-1" />
          <button
            onClick={() => {
              if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume().catch(() => {});
              }
              const nextMuted = !isAudioMuted;
              setIsAudioMuted(nextMuted);
              if (!nextMuted) {
                playGentleNocChime();
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              hasAnySoundAlertTriggered
                ? (isAudioMuted ? "bg-amber-500/20 text-amber-300 border border-amber-500/40" : "bg-red-500/30 text-red-300 border border-red-500/50 animate-pulse")
                : (isAudioMuted ? "bg-slate-800/80 text-slate-500 border border-slate-700" : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700")
            }`}
            title={
              isAudioMuted 
                ? "Alerta sonoro mutado. Clique para reativar o áudio." 
                : hasAnySoundAlertTriggered 
                ? "Dispositivo offline emitindo som a cada 2s! Clique para silenciar." 
                : "Alerta sonoro ativado para dispositivos offline (2s). Clique para silenciar/testar."
            }
          >
            {isAudioMuted ? (
              <VolumeX size={14} className="text-slate-400" />
            ) : hasAnySoundAlertTriggered ? (
              <Volume2 size={14} className="text-red-400 animate-bounce" />
            ) : (
              <Volume2 size={14} className="text-emerald-400" />
            )}
            <span className="hidden sm:inline text-[11px]">
              {isAudioMuted 
                ? "Mudo" 
                : hasAnySoundAlertTriggered 
                ? "Alarme 2s!" 
                : `Som (2s)${soundAlertsActiveCount > 0 ? ` (${soundAlertsActiveCount})` : ""}`}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <RefreshCw size={40} className="animate-spin mb-4 text-blue-500 opacity-60" />
            <p className="font-bold text-sm">Carregando Diagrama de Topologia & Zabbix Status...</p>
          </div>
        ) : (
          /* Transformed Inner Canvas Layer */
          <div 
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              transition: isPanning || draggingNodeId ? "none" : "transform 0.1s ease-out"
            }}
            className="w-[4000px] h-[3000px] absolute inset-0"
          >
            
            {/* Background Image (Planta Baixa) */}
            {mapData.background_image_url && (
              <img 
                src={mapData.background_image_url} 
                alt="Planta Baixa" 
                className="absolute top-0 left-0 w-full h-full object-contain opacity-50 pointer-events-none -z-20"
                style={{ objectPosition: "center" }}
              />
            )}

            {/* Background Grid Lines Pattern */}
            <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#334155_1.5px,transparent_1.5px)] [background-size:28px_28px]" />

            {/* SVG Layer para Contornos Dinâmicos Adaptativos de Áreas (z-10) e Cabos (z-20) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              {/* Contornos Geométricos Adaptativos das Áreas / Blocos (moldam-se aos nós em tempo real) */}
              {mapData.nodes_data.filter(n => n.icon_type === 'Zone').map((zone) => {
                const geom = getZoneGeometry(zone, mapData.nodes_data);
                if (!geom.hasMembers || !geom.path) return null;
                const theme = ZONE_COLOR_THEMES[zone.color] || ZONE_COLOR_THEMES.blue;
                const isSelected = String(selectedNodeId) === String(zone.id);

                return (
                  <g key={zone.id} className="pointer-events-auto cursor-pointer">
                    {/* Linha de brilho externa quando selecionado */}
                    {isSelected && (
                      <path
                        d={geom.path}
                        fill="none"
                        stroke={theme.stroke}
                        strokeWidth="8"
                        opacity="0.25"
                      />
                    )}
                    {/* Contorno Adaptativo com Borda Tracejada e Preenchimento Translúcido */}
                    <path
                      d={geom.path}
                      fill={isSelected ? theme.fillSelected : theme.fill}
                      stroke={theme.stroke}
                      strokeWidth={isSelected ? "3" : "2"}
                      strokeDasharray="8 6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(zone.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!isPublicView) openEditZoneModal(zone.id);
                      }}
                    />
                  </g>
                );
              })}
              {mapData.edges_data.map((edge) => {
                const sourceNode = mapData.nodes_data.find(n => n.id === edge.source_id);
                const targetNode = mapData.nodes_data.find(n => n.id === edge.target_id);

                if (!sourceNode || !targetNode) return null;

                // Coordenadas centrais
                const sourceWidth = sourceNode.width || (sourceNode.icon_type === 'Rack' || sourceNode.icon_type === 'Zone' ? 280 : 220);
                const targetWidth = targetNode.width || (targetNode.icon_type === 'Rack' || targetNode.icon_type === 'Zone' ? 280 : 220);
                const x1 = sourceNode.x + Math.round(sourceWidth / 2);
                const y1 = sourceNode.y + 45;
                const x2 = targetNode.x + Math.round(targetWidth / 2);
                const y2 = targetNode.y + 45;

                const isSourceOffline = sourceNode.icmp_status === "offline";
                const isTargetOffline = targetNode.icmp_status === "offline";
                const isProblemLink = isSourceOffline || isTargetOffline;

                const strokeColor = isProblemLink ? "#ef4444" : "#10b981";

                return (
                  <g 
                    key={edge.id}
                    className="pointer-events-auto cursor-pointer group"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isPublicView) {
                        openEditEdgeModal(edge.id);
                      }
                    }}
                  >
                    {/* Linha invisível mais espessa para facilitar o clique no cabo */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="transparent"
                      strokeWidth="18"
                    />

                    {/* Cable Connection Line */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={strokeColor}
                      strokeWidth={isProblemLink ? "3" : "2"}
                      strokeDasharray={isProblemLink ? "6,6" : "none"}
                      className={`${isProblemLink ? "animate-pulse" : ""} group-hover:stroke-purple-400 group-hover:stroke-[3.5px] transition-all`}
                      opacity="0.85"
                    />

                    {/* Edge Label (Interface / Port Tag, ex: GE1/0/4) */}
                    <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                      <rect
                        x="-45"
                        y="-10"
                        width="90"
                        height="20"
                        rx="6"
                        fill="#090d16"
                        stroke={strokeColor}
                        strokeWidth="1"
                        className="group-hover:stroke-purple-400 group-hover:fill-purple-950 transition-all"
                        opacity="0.95"
                      />
                      <text
                        x="0"
                        y="3"
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize="9"
                        fontWeight="bold"
                        fontFamily="monospace"
                        className="group-hover:fill-white"
                      >
                        {edge.label || "Link"}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>

            {/* Layer DOM de Cabeçalhos Flutuantes & Áreas Vazias (z-15) */}
            <div className="absolute inset-0 pointer-events-none z-15">
              {mapData.nodes_data.filter(n => n.icon_type === 'Zone').map((zone) => {
                const geom = getZoneGeometry(zone, mapData.nodes_data);
                const theme = ZONE_COLOR_THEMES[zone.color] || ZONE_COLOR_THEMES.blue;
                const isSelected = String(selectedNodeId) === String(zone.id);

                // ÁREA COM MEMBROS: Cabeçalho flutuante que acompanha o topo do contorno
                if (geom.hasMembers) {
                  return (
                    <div
                      key={zone.id}
                      style={{
                        left: `${geom.headerX}px`,
                        top: `${geom.headerY}px`,
                      }}
                      className="absolute pointer-events-auto"
                    >
                      <div
                        onMouseDown={(e) => handleMouseDownZone(zone.id, e)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNodeId(zone.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          if (!isPublicView) openEditZoneModal(zone.id);
                        }}
                        className={`px-3 py-1 rounded-full border shadow-lg flex items-center gap-2 cursor-grab active:cursor-grabbing ${theme.headerBg} backdrop-blur-md select-none ${
                          isSelected ? "ring-2 ring-white/60 shadow-xl" : ""
                        }`}
                        title={!isPublicView ? "Arraste pelo cabeçalho para mover todo o bloco ou clique duas vezes para editar" : ""}
                      >
                        <Layers size={13} className={theme.accent} />
                        <span className="text-xs font-black tracking-wide uppercase">
                          {zone.label}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-black/50 text-slate-300 font-mono">
                          {geom.membersCount} {geom.membersCount === 1 ? 'item' : 'itens'}
                        </span>

                        {!isPublicView && (
                          <div className="flex items-center gap-1 ml-1 border-l border-white/20 pl-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditZoneModal(zone.id);
                              }}
                              className="p-1 hover:bg-white/20 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                              title="Editar configurações e membros desta área"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteZone(zone.id);
                              }}
                              className="p-1 hover:bg-red-500/40 rounded text-red-300 hover:text-red-200 transition-colors cursor-pointer"
                              title="Excluir esta área (mantém os equipamentos)"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ÁREA VAZIA (0 membros): Delimitador com card central para visualização e edição
                return (
                  <div
                    key={zone.id}
                    onMouseDown={(e) => handleMouseDownNode(zone.id, e)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(zone.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!isPublicView) openEditZoneModal(zone.id);
                    }}
                    style={{
                      left: `${geom.minX}px`,
                      top: `${geom.minY}px`,
                      width: `${geom.width}px`,
                      height: `${geom.height}px`,
                    }}
                    className={`absolute rounded-3xl border-2 border-dashed ${theme.border} ${theme.bg} pointer-events-auto cursor-grab active:cursor-grabbing p-4 flex flex-col items-center justify-center text-center ${
                      isSelected ? `ring-4 ${theme.ring} shadow-2xl` : ''
                    }`}
                  >
                    <div className={`p-2.5 rounded-2xl ${theme.badge} mb-1.5 shadow-sm`}>
                      <Layers size={22} className={theme.accent} />
                    </div>
                    <span className="text-xs font-black text-white tracking-wide uppercase">{zone.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Área sem equipamentos vinculados</span>
                    {!isPublicView && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditZoneModal(zone.id);
                        }}
                        className="mt-2.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
                      >
                        <Edit3 size={12} /> Editar Nome & Vincular Itens
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DOM Layer for Network Nodes / Hardware Cards */}
            <div className="absolute inset-0 pointer-events-none">
              {mapData.nodes_data.filter(n => n.icon_type !== 'Zone').map((node) => {
                const isOffline = getIsNodeOffline(node);
                const isSelected = String(selectedNodeId) === String(node.id);
                const nodeWidth = node.width || (node.icon_type === 'Rack' || node.icon_type === 'Zone' ? 280 : 220);
                const nodeHeight = node.height || null;

                return (
                  <div
                    key={node.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    onMouseDown={(e) => handleMouseDownNode(node.id, e)}
                    onDoubleClick={() => {
                      if (!isPublicView) {
                        openEditNodeModal(node.id);
                      }
                    }}
                    style={{ 
                      left: `${node.x}px`, 
                      top: `${node.y}px`,
                      width: `${nodeWidth}px`,
                      minHeight: nodeHeight ? `${nodeHeight}px` : undefined,
                    }}
                    className={`absolute transition-all duration-150 cursor-grab active:cursor-grabbing shadow-xl pointer-events-auto ${
                      node.icon_type === 'Zone' 
                        ? "p-4 border-4 border-dashed rounded-3xl z-30 backdrop-blur-md " + (
                          isOffline ? "border-red-500 bg-red-950/80 animate-bounce" : "border-slate-500 bg-slate-800/80"
                        )
                        : node.icon_type === 'Rack' 
                        ? "p-4 border-2 rounded-xl z-30 backdrop-blur-md " + (
                          isOffline ? "border-red-500 bg-red-950/80 animate-bounce" : "border-slate-400 bg-slate-900/90 shadow-xl"
                        )
                        : "p-3 rounded-2xl border z-30 backdrop-blur-md " + (
                          isOffline
                            ? "bg-red-950/80 border-red-500 text-white ring-4 ring-red-500/20 animate-bounce"
                            : isSelected
                            ? "bg-slate-900 border-blue-500 ring-2 ring-blue-500/40 text-white"
                            : "bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200"
                        )
                    }`}
                  >
                    {/* Node Icon Header */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className={`p-2 rounded-xl ${
                        isOffline ? "bg-red-500/20 border border-red-500/30" : "bg-slate-800"
                      }`}>
                        {renderNodeIcon(node.icon_type, false, isOffline)}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!isPublicView && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNodeId(node.id);
                              openEditNodeModal(node.id);
                            }}
                            className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Editar configurações deste equipamento"
                          >
                            <Edit3 size={12} />
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!isPublicView) {
                              const updatedNodes = mapData.nodes_data.map(n => 
                                n.id === node.id ? { ...n, sound_alert_offline: !n.sound_alert_offline } : n
                              );
                              setMapData(prev => ({
                                ...prev,
                                nodes_data: updatedNodes
                              }));
                              if (mapData.id) {
                                try {
                                  const payload = {
                                    name: mapData.name,
                                    description: mapData.description,
                                    nodes_data: updatedNodes,
                                    edges_data: mapData.edges_data,
                                    zoom_level: zoom,
                                    pan_x: Math.round(pan.x),
                                    pan_y: Math.round(pan.y),
                                    background_image_url: mapData.background_image_url,
                                  };
                                  const res = await api.put(`/network-maps/${mapData.id}`, payload);
                                  if (res.data) {
                                    setMapData(res.data);
                                    setHasUnsavedChanges(false);
                                  }
                                } catch (err) {
                                  console.error("Erro ao alternar som:", err);
                                }
                              }
                            }
                          }}
                          title={
                            node.sound_alert_offline 
                              ? (isOffline ? "Alerta Sonoro Disparado (2s)! Clique para desativar som deste nó." : "Alerta sonoro ativo para este nó quando offline. Clique para desativar.")
                              : "Alerta sonoro desativado para este nó. Clique para ativar som se ficar offline."
                          }
                          className={`p-1 rounded-md transition-all ${
                            node.sound_alert_offline
                              ? (isOffline 
                                  ? "bg-red-500/30 text-red-300 animate-pulse ring-1 ring-red-500/50" 
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30")
                              : "text-slate-600 hover:text-slate-400 hover:bg-slate-800/60 opacity-60 hover:opacity-100"
                          } ${isPublicView ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <Bell size={12} className={node.sound_alert_offline ? "fill-amber-400/20" : ""} />
                        </button>
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          isOffline ? "bg-red-500 animate-ping" : "bg-emerald-500 animate-pulse"
                        }`} />
                      </div>
                    </div>

                    {/* Node Label & Subtext */}
                    <div>
                      <div className="flex items-center gap-1 group/title">
                        <p 
                          onClick={(e) => {
                            if (!isPublicView) {
                              e.stopPropagation();
                              setSelectedNodeId(node.id);
                              openEditNodeModal(node.id);
                            }
                          }}
                          className={`font-extrabold text-xs text-white break-words line-clamp-2 ${!isPublicView ? 'cursor-pointer hover:text-blue-300 hover:underline' : ''}`}
                          title={!isPublicView ? "Clique para editar o nome deste equipamento" : node.label}
                        >
                          {node.label}
                        </p>
                      </div>
                      
                      {node.ip_address && (node.display_options?.show_ip ?? node.rack_display_options?.show_ip ?? true) && (
                        <p className="text-[10px] font-mono text-slate-400 font-bold truncate">
                          {node.ip_address}
                        </p>
                      )}
                      {node.zone_id && (
                        (() => {
                          const parentZone = mapData.nodes_data.find(z => z.id === node.zone_id);
                          if (!parentZone) return null;
                          const zTheme = ZONE_COLOR_THEMES[parentZone.color] || ZONE_COLOR_THEMES.blue;
                          return (
                            <div className="mt-1">
                              <span className={`inline-flex items-center gap-1 text-[8.5px] font-extrabold px-1.5 py-0.5 rounded-md ${zTheme.badge} truncate max-w-full`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${zTheme.dot}`} />
                                {parentZone.label}
                              </span>
                            </div>
                          );
                        })()
                      )}
                      {node.child_asset_ids && node.child_asset_ids.length > 0 && (
                        <div className="mt-2 w-full">
                          <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            {node.child_asset_ids.length} {node.child_asset_ids.length === 1 ? 'Equipamento' : 'Equipamentos'}
                          </div>
                          <div className="space-y-1">
                            {node.child_asset_ids.map(cid => {
                              const child = assetsList.find(a => String(a.id) === String(cid));
                              if (!child) return null;
                              const childUnifiDev = child.ip_address ? unifiMetrics.find(um => um.ip === child.ip_address) : null;
                              const childOffline = child.icmp_status === "offline" || (childUnifiDev && childUnifiDev.state === 0);
                              
                              const showIp = node.display_options?.show_ip ?? node.rack_display_options?.show_ip ?? true;
                              const unifiMetricsSelected = node.display_options?.unifi_metrics ?? node.rack_display_options?.unifi_metrics ?? ['cpu', 'ram', 'uptime', 'fw', 'wifi_experience', 'clients', 'channel_utilization', 'lan_experience', 'rx_tx'];
                              
                              return (
                                <div key={cid} className={`flex flex-col gap-1.5 px-2 py-1.5 rounded-lg text-[10px] ${childOffline ? 'bg-red-900/40 border border-red-500/30' : 'bg-slate-800/60'}`}>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${childOffline ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
                                    <span className="font-bold text-white break-words line-clamp-2 flex-1" title={child.name}>{child.name}</span>
                                    {showIp && <span className="font-mono text-slate-400 text-[9px] shrink-0">{child.ip_address || ''}</span>}
                                  </div>
                                  {childUnifiDev && <UnifiMetricsBlock unifiDev={childUnifiDev} selectedMetrics={unifiMetricsSelected} />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Renderização das Métricas Zabbix dentro do Card */}
                    {node.asset_id && liveMetrics[node.asset_id] && (node.zabbix_selected_metrics === undefined || node.zabbix_selected_metrics === null || node.zabbix_selected_metrics.length > 0) && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-700/50 pt-2">
                        {liveMetrics[node.asset_id].map((iface, idx) => {
                          // Se o usuário selecionou métricas específicas (array existe), mostramos apenas as selecionadas.
                          // Se o array for vazio, não exibe nada.
                          if (node.zabbix_selected_metrics !== undefined && node.zabbix_selected_metrics !== null) {
                            if (node.zabbix_selected_metrics.length === 0) return null;
                            const assetObj = assetsList.find(a => String(a.id) === String(node.asset_id));
                            if (assetObj && assetObj.zabbix_items) {
                              const checkedItemsForThisIface = assetObj.zabbix_items.filter(
                                i => i.interface_name === iface.interface_name && node.zabbix_selected_metrics.some(m => (typeof m === 'string' ? m : m.name) === i.name)
                              );
                              if (checkedItemsForThisIface.length === 0) return null;
                            } else {
                              return null;
                            }
                          }

                          const isDown = iface.status === "down";
                          return (
                            <div key={idx} className={`bg-slate-950/50 rounded-lg p-1.5 border ${isDown ? 'border-red-500/30' : 'border-slate-800'} text-[9px] flex flex-col gap-1`}>
                              <div className="flex items-center justify-between font-bold border-b border-slate-800 pb-1 mb-0.5">
                                <span className="text-slate-300 truncate max-w-[80px]" title={iface.interface_name}>{iface.interface_name}</span>
                                {iface.status !== "unknown" && (
                                  <span className={isDown ? "text-red-400" : "text-emerald-400"}>
                                    {isDown ? "DOWN" : "UP"}
                                  </span>
                                )}
                              </div>
                              {node.zabbix_selected_metrics
                                .filter(m => {
                                  const mName = typeof m === 'string' ? m : m.name;
                                  return iface.raw_items && iface.raw_items[mName] !== undefined;
                                })
                                .map(m => {
                                  const mName = typeof m === 'string' ? m : m.name;
                                  const customLabel = typeof m === 'string' ? (mName.split(': ').pop() || mName) : (m.custom_label || mName.split(': ').pop() || mName);
                                  return (
                                  <div key={mName} className="flex justify-between items-center text-slate-500 font-mono text-[8px]">
                                    <span className="truncate pr-2" title={customLabel}>{customLabel}</span>
                                    <span className={String(iface.raw_items[mName]).includes("DOWN") || String(iface.raw_items[mName]).includes("ERROR") ? "text-red-400 font-bold" : "text-emerald-400"}>
                                      {iface.raw_items[mName]}
                                    </span>
                                  </div>
                                )})}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Renderização das Métricas UniFi */}
                    {unifiMetrics.length > 0 && (node.ip_address || (node.asset_id && assetsList.find(a => String(a.id) === String(node.asset_id))?.ip_address)) && (
                      <UnifiMetricsBlock 
                        unifiDev={unifiMetrics.find(u => u.ip === (node.ip_address || assetsList.find(a => String(a.id) === String(node.asset_id))?.ip_address))} 
                        selectedMetrics={node.display_options?.unifi_metrics ?? node.rack_display_options?.unifi_metrics ?? DEFAULT_DISPLAY_OPTIONS.unifi_metrics} 
                      />
                    )}

                    {/* Alça Interativa de Redimensionamento (Bottom-Right Resize Handle) */}
                    {isSelected && !isPublicView && (
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizingNodeId(node.id);
                          const curW = node.width || (node.icon_type === 'Rack' || node.icon_type === 'Zone' ? 280 : 220);
                          const curH = node.height || 0;
                          setResizeStart({ x: e.clientX, y: e.clientY, w: curW, h: curH });
                        }}
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center cursor-se-resize shadow-md z-40 border border-white/40 transition-transform hover:scale-125"
                        title="Arraste para redimensionar largura e altura deste card"
                      >
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M21 15v6m0 0h-6m6 0l-7-7" />
                        </svg>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal Adicionar Nó */}
      {isAddNodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Plus size={18} className="text-blue-400" /> Adicionar Equipamento à Topologia
              </h3>
              <button onClick={() => setIsAddNodeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Vincular Ativo do CMDB (Opcional):</label>
                <select
                  value={newNodeForm.asset_id}
                  onChange={async (e) => {
                    const assetId = e.target.value;
                    const selected = assetsList.find(a => String(a.id) === assetId);
                    
                    setNewNodeForm(prev => ({
                      ...prev,
                      asset_id: assetId,
                      label: selected ? selected.name : prev.label,
                      zabbix_selected_metrics: []
                    }));
                    setAvailableZabbixItems([]);
                    setSelectedZabbixInterface("");

                    if (assetId && selected && selected.zabbix_items) {
                      setAvailableZabbixItems(selected.zabbix_items);
                      const interfaces = Array.from(new Set(selected.zabbix_items.map(i => i.interface_name).filter(Boolean)));
                      if (interfaces.length > 0) setSelectedZabbixInterface(interfaces[0]);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                >
                  <option value="">Nenhum (Equipamento de Infra / Link)</option>
                  {assetsList.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.ip_address || "Sem IP"}) • {a.type}</option>
                  ))}
                </select>
              </div>




              
              <div>
                <label className="block text-slate-400 font-bold mb-1">Endereço IP (Opcional - Necessário para UniFi se não tiver CMDB):</label>
                <input
                  type="text"
                  placeholder="Ex: 192.168.1.10"
                  value={newNodeForm.ip_address}
                  onChange={(e) => setNewNodeForm(prev => ({ ...prev, ip_address: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nome / Rótulo no Mapa:</label>
                <input
                  type="text"
                  placeholder="Ex: Switch_Core_01, AP-Recepcao..."
                  value={newNodeForm.label}
                  onChange={(e) => setNewNodeForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
                  <span>Área / Bloco de Agrupamento:</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {mapData.nodes_data.filter(n => n.icon_type === 'Zone').length} área(s) disponível(is)
                  </span>
                </label>
                <select
                  value={newNodeForm.zone_id || ""}
                  onChange={(e) => setNewNodeForm(prev => ({ ...prev, zone_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                >
                  <option value="">Nenhuma (Equipamento Avulso / Fora de Bloco)</option>
                  {mapData.nodes_data.filter(n => n.icon_type === 'Zone').map(z => (
                    <option key={z.id} value={z.id}>🏢 {z.label}</option>
                  ))}
                </select>
                {mapData.nodes_data.filter(n => n.icon_type === 'Zone').length === 0 && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Nenhuma área cadastrada neste fluxograma. Crie uma área com o botão "Nova Área / Bloco".
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Tipo de Ícone:</label>
                <select
                  value={newNodeForm.icon_type}
                  onChange={(e) => setNewNodeForm(prev => ({ ...prev, icon_type: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                >
                  <option value="Switch">Switch / Roteador</option>
                  <option value="AccessPoint">Access Point (Wi-Fi)</option>
                  <option value="Phone">Telefone IP / Ramal</option>
                  <option value="Server">Servidor / Datacenter</option>
                  <option value="Firewall">Firewall / Gateway</option>
                  <option value="Cloud">Link de Provedor WAN / Nuvem</option>
                  <option value="Rack">Rack (Contêiner)</option>
                  <option value="Zone">Ambiente / Sala (Zona)</option>
                </select>
              </div>

              {/* Seleção de Filhos para Racks e Zonas */}
              {(newNodeForm.icon_type === 'Rack' || newNodeForm.icon_type === 'Zone') && (
                <div className="mt-3">
                  <label className="block text-slate-400 font-bold mb-1 flex items-center gap-2">
                    <CheckCircle size={14} className="text-blue-500"/>
                    Ativos Contidos (Agrupamento):
                  </label>
                  <div className="max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl p-2 space-y-1">
                    {assetsList.map(a => {
                      const isChecked = newNodeForm.child_asset_ids?.includes(String(a.id));
                      return (
                        <label key={a.id} className={`flex items-center gap-2 text-xs p-1.5 rounded-md cursor-pointer transition-colors ${isChecked ? 'bg-blue-900/40 text-blue-300' : 'text-slate-300 hover:bg-slate-800'}`}>
                          <input 
                            type="checkbox" 
                            className="w-3.5 h-3.5 accent-blue-500 rounded"
                            checked={isChecked}
                            onChange={(e) => {
                              const newIds = e.target.checked 
                                ? [...(newNodeForm.child_asset_ids || []), String(a.id)]
                                : (newNodeForm.child_asset_ids || []).filter(id => id !== String(a.id));
                              setNewNodeForm(prev => ({...prev, child_asset_ids: newIds}));
                            }}
                          />
                          <span className="font-semibold truncate">{a.name}</span>
                          <span className="text-[9px] text-slate-500 ml-auto font-mono">{a.ip_address}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dimensões do Card (Largura e Altura) */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold text-xs flex items-center gap-1.5">
                    <Maximize2 size={13} className="text-blue-400" />
                    Dimensões do Card (Largura / Altura):
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {newNodeForm.width ? `${newNodeForm.width}px` : "Largura Auto"} × {newNodeForm.height ? `${newNodeForm.height}px` : "Altura Auto"}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Largura:</span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        min="140"
                        max="800"
                        placeholder={newNodeForm.icon_type === 'Rack' || newNodeForm.icon_type === 'Zone' ? "280 (Padrão)" : "220 (Padrão)"}
                        value={newNodeForm.width}
                        onChange={(e) => setNewNodeForm(prev => ({ ...prev, width: e.target.value }))}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-white text-xs outline-none focus:border-blue-500"
                      />
                      <span className="text-slate-500 text-[10px]">px</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      { label: "Padrão", w: "" },
                      { label: "Médio (280px)", w: "280" },
                      { label: "Largo (340px)", w: "340" },
                      { label: "Extra Largo (420px)", w: "420" }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setNewNodeForm(prev => ({ ...prev, width: preset.w }))}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                          newNodeForm.width === preset.w 
                            ? "bg-blue-600 text-white font-bold" 
                            : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Altura Mínima (opcional):</span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        min="60"
                        max="1500"
                        placeholder="Auto"
                        value={newNodeForm.height}
                        onChange={(e) => setNewNodeForm(prev => ({ ...prev, height: e.target.value }))}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-white text-xs outline-none focus:border-blue-500"
                      />
                      <span className="text-slate-500 text-[10px]">px</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Alerta Sonoro Quando Offline (2s) */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${newNodeForm.sound_alert_offline ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-900 text-slate-500'}`}>
                    <Bell size={16} />
                  </div>
                  <div>
                    <label className="text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer" onClick={() => setNewNodeForm(prev => ({ ...prev, sound_alert_offline: !prev.sound_alert_offline }))}>
                      Alerta Sonoro se Offline (2s)
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Toca sinal suave intercalado a cada 2 segundos quando o equipamento ficar offline.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!newNodeForm.sound_alert_offline}
                  onChange={(e) => setNewNodeForm(prev => ({ ...prev, sound_alert_offline: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Opções de Exibição / Métricas UniFi (Para Rack ou Dispositivo Avulso) */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <label className="block text-slate-300 font-bold text-xs flex items-center gap-1.5">
                  <Activity size={14} className="text-emerald-400" />
                  {newNodeForm.icon_type === 'Rack' || newNodeForm.icon_type === 'Zone' 
                    ? "Opções de Exibição dos Itens no Rack:" 
                    : "Opções de Exibição do Dispositivo:"}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 accent-blue-500 rounded"
                      checked={newNodeForm.display_options?.show_ip ?? newNodeForm.rack_display_options?.show_ip ?? true}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setNewNodeForm(prev => ({
                          ...prev,
                          display_options: {
                            ...(prev.display_options || prev.rack_display_options || DEFAULT_DISPLAY_OPTIONS),
                            show_ip: val
                          },
                          rack_display_options: {
                            ...(prev.rack_display_options || prev.display_options || DEFAULT_DISPLAY_OPTIONS),
                            show_ip: val
                          }
                        }));
                      }}
                    />
                    Mostrar Endereço IP
                  </label>

                  <div className="border-t border-slate-800 mt-2 pt-2">
                    <label className="block text-slate-400 font-bold mb-2 text-xs">Métricas UniFi (Detalhes Avançados):</label>
                    <div className="grid grid-cols-2 gap-2 pl-2">
                      {[
                        { id: 'cpu', label: 'CPU' },
                        { id: 'ram', label: 'RAM' },
                        { id: 'uptime', label: 'Uptime' },
                        { id: 'fw', label: 'Firmware' },
                        { id: 'wifi_experience', label: 'WiFi Exp. (AP)' },
                        { id: 'clients', label: 'Clientes (AP)' },
                        { id: 'channel_utilization', label: 'Uso de Canal (AP)' },
                        { id: 'lan_experience', label: 'LAN Exp. (SW)' },
                        { id: 'rx_tx', label: 'RX/TX Rates (SW)' }
                      ].map(metric => {
                        const currentOpts = newNodeForm.display_options || newNodeForm.rack_display_options || DEFAULT_DISPLAY_OPTIONS;
                        const isMetricChecked = (currentOpts.unifi_metrics || []).includes(metric.id);
                        return (
                          <label key={metric.id} className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-400 hover:text-slate-200">
                            <input 
                              type="checkbox" 
                              className="w-3 h-3 accent-blue-500 rounded"
                              checked={isMetricChecked}
                              onChange={(e) => {
                                const currMetrics = currentOpts.unifi_metrics || [];
                                const newMetrics = e.target.checked
                                  ? [...currMetrics, metric.id]
                                  : currMetrics.filter(m => m !== metric.id);
                                setNewNodeForm(prev => ({
                                  ...prev,
                                  display_options: {
                                    ...(prev.display_options || prev.rack_display_options || DEFAULT_DISPLAY_OPTIONS),
                                    unifi_metrics: newMetrics
                                  },
                                  rack_display_options: {
                                    ...(prev.rack_display_options || prev.display_options || DEFAULT_DISPLAY_OPTIONS),
                                    unifi_metrics: newMetrics
                                  }
                                }));
                              }}
                            />
                            {metric.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {availableZabbixItems.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="mb-3">
                    <label className="block text-slate-300 font-black mb-1">Selecione o Grupo / Interface:</label>
                    <select
                      value={selectedZabbixInterface}
                      onChange={(e) => setSelectedZabbixInterface(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione uma interface</option>
                      {Array.from(new Set(availableZabbixItems.map(i => i.interface_name).filter(Boolean))).map(iface => (
                        <option key={iface} value={iface}>{iface}</option>
                      ))}
                      <option value="geral">Métricas Gerais / Sem Interface</option>
                    </select>
                  </div>

                  {selectedZabbixInterface && (
                    <>
                      <label className="block text-slate-300 font-black mb-2">Exibir Métricas neste Nó:</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800">
                        {availableZabbixItems
                          .filter(i => (selectedZabbixInterface === "geral" ? !i.interface_name : i.interface_name === selectedZabbixInterface))
                          .map(item => {
                            const isChecked = newNodeForm.zabbix_selected_metrics.some(m => (typeof m === 'string' ? m : m.name) === item.name);
                            const metricObj = newNodeForm.zabbix_selected_metrics.find(m => (typeof m === 'string' ? m : m.name) === item.name) || {};
                            const customLabel = typeof metricObj === 'string' ? (metricObj.split(': ').pop() || metricObj) : (metricObj.custom_label || item.name.split(': ').pop() || item.name);
                            return (
                              <div key={item.name} className="flex flex-col gap-1">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setNewNodeForm(prev => {
                                        const curr = [...prev.zabbix_selected_metrics];
                                        if (e.target.checked) curr.push({ name: item.name, custom_label: item.name.split(': ').pop() || item.name });
                                        else {
                                          const idx = curr.findIndex(m => (typeof m === 'string' ? m : m.name) === item.name);
                                          if (idx > -1) curr.splice(idx, 1);
                                        }
                                        return { ...prev, zabbix_selected_metrics: curr };
                                      });
                                    }}
                                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500/50 cursor-pointer"
                                  />
                                  <span className="text-slate-400 font-bold group-hover:text-white transition-colors text-xs">{item.name}</span>
                                </label>
                                {isChecked && (
                                  <div className="pl-6 pb-2 flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-500 font-bold">Rótulo no Mapa (Personalizado):</label>
                                    <input
                                      type="text"
                                      value={customLabel}
                                      onChange={(e) => {
                                        setNewNodeForm(prev => {
                                          const curr = [...prev.zabbix_selected_metrics];
                                          const idx = curr.findIndex(m => (typeof m === 'string' ? m : m.name) === item.name);
                                          if (idx > -1) curr[idx] = { name: item.name, custom_label: e.target.value };
                                          return { ...prev, zabbix_selected_metrics: curr };
                                        });
                                      }}
                                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-blue-500 w-full"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">
                        Apenas os itens marcados aparecerão dentro do bloco na topologia.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button onClick={() => setIsAddNodeModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer">Cancelar</button>
              <button onClick={handleAddNode} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black cursor-pointer">Adicionar Nó</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Nó */}
      {isEditNodeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Edit3 size={18} className="text-blue-400" /> Editar Equipamento
              </h3>
              <button onClick={() => setIsEditNodeModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Vincular Ativo do CMDB (Opcional):</label>
                <select
                  value={editNodeForm.asset_id}
                  onChange={async (e) => {
                    const assetId = e.target.value;
                    const selected = assetsList.find(a => String(a.id) === assetId);
                    
                    setEditNodeForm(prev => ({
                      ...prev,
                      asset_id: assetId,
                      label: selected ? selected.name : prev.label,
                      zabbix_selected_metrics: []
                    }));
                    setAvailableZabbixMetrics([]);

                    if (assetId && selected && selected.zabbix_items) {
                      setAvailableZabbixMetrics(selected.zabbix_items.map(i => i.name));
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                >
                  <option value="">Nenhum (Equipamento de Infra / Link)</option>
                  {assetsList.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({a.ip_address || "Sem IP"}) • {a.type}</option>
                  ))}
                </select>
              </div>




              
              <div>
                <label className="block text-slate-400 font-bold mb-1">Endereço IP (Opcional - Necessário para UniFi se não tiver CMDB):</label>
                <input
                  type="text"
                  placeholder="Ex: 192.168.1.10"
                  value={editNodeForm.ip_address || ""}
                  onChange={(e) => setEditNodeForm(prev => ({ ...prev, ip_address: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nome / Rótulo no Mapa:</label>
                <input
                  type="text"
                  placeholder="Ex: Switch_Core_01, AP-Recepcao..."
                  value={editNodeForm.label}
                  onChange={(e) => setEditNodeForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
                  <span>Área / Bloco de Agrupamento:</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {mapData.nodes_data.filter(n => n.icon_type === 'Zone').length} área(s) disponível(is)
                  </span>
                </label>
                <select
                  value={editNodeForm.zone_id || ""}
                  onChange={(e) => setEditNodeForm(prev => ({ ...prev, zone_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                >
                  <option value="">Nenhuma (Equipamento Avulso / Fora de Bloco)</option>
                  {mapData.nodes_data.filter(n => n.icon_type === 'Zone' && String(n.id) !== String(editNodeForm.id)).map(z => (
                    <option key={z.id} value={z.id}>🏢 {z.label}</option>
                  ))}
                </select>
                {mapData.nodes_data.filter(n => n.icon_type === 'Zone').length === 0 && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Nenhuma área cadastrada neste fluxograma. Crie uma área com o botão "Nova Área / Bloco".
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Tipo de Ícone:</label>
                <select
                  value={editNodeForm.icon_type}
                  onChange={(e) => setEditNodeForm(prev => ({ ...prev, icon_type: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                >
                  <option value="Switch">Switch / Roteador</option>
                  <option value="AccessPoint">Access Point (Wi-Fi)</option>
                  <option value="Phone">Telefone IP / Ramal</option>
                  <option value="Server">Servidor / Datacenter</option>
                  <option value="Firewall">Firewall / Gateway</option>
                  <option value="Cloud">Link de Provedor WAN / Nuvem</option>
                  <option value="Rack">Rack (Contêiner)</option>
                  <option value="Zone">Ambiente / Sala (Zona)</option>
                </select>
              </div>

              {/* Dimensões do Card (Largura e Altura) */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold text-xs flex items-center gap-1.5">
                    <Maximize2 size={13} className="text-blue-400" />
                    Dimensões do Card (Largura / Altura):
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {editNodeForm.width ? `${editNodeForm.width}px` : "Largura Auto"} × {editNodeForm.height ? `${editNodeForm.height}px` : "Altura Auto"}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Largura:</span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        min="140"
                        max="800"
                        placeholder={editNodeForm.icon_type === 'Rack' || editNodeForm.icon_type === 'Zone' ? "280 (Padrão)" : "220 (Padrão)"}
                        value={editNodeForm.width}
                        onChange={(e) => setEditNodeForm(prev => ({ ...prev, width: e.target.value }))}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-white text-xs outline-none focus:border-blue-500"
                      />
                      <span className="text-slate-500 text-[10px]">px</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {[
                      { label: "Padrão", w: "" },
                      { label: "Médio (280px)", w: "280" },
                      { label: "Largo (340px)", w: "340" },
                      { label: "Extra Largo (420px)", w: "420" }
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setEditNodeForm(prev => ({ ...prev, width: preset.w }))}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                          editNodeForm.width === preset.w 
                            ? "bg-blue-600 text-white font-bold" 
                            : "bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Altura Mínima (opcional):</span>
                    <div className="flex items-center gap-1 font-mono">
                      <input
                        type="number"
                        min="60"
                        max="1500"
                        placeholder="Auto"
                        value={editNodeForm.height}
                        onChange={(e) => setEditNodeForm(prev => ({ ...prev, height: e.target.value }))}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-center font-bold text-white text-xs outline-none focus:border-blue-500"
                      />
                      <span className="text-slate-500 text-[10px]">px</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seleção de Filhos para Racks e Zonas */}
              {(editNodeForm.icon_type === 'Rack' || editNodeForm.icon_type === 'Zone') && (
                <div className="mt-3">
                  <label className="block text-slate-400 font-bold mb-1 flex items-center gap-2">
                    <CheckCircle size={14} className="text-blue-500"/>
                    Ativos Contidos (Agrupamento):
                  </label>
                  <div className="max-h-48 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl p-2 space-y-1">
                    {assetsList.map(a => {
                      const isChecked = editNodeForm.child_asset_ids?.includes(String(a.id));
                      return (
                        <label key={a.id} className={`flex items-center gap-2 text-xs p-1.5 rounded-md cursor-pointer transition-colors ${isChecked ? 'bg-blue-900/40 text-blue-300' : 'text-slate-300 hover:bg-slate-800'}`}>
                          <input 
                            type="checkbox" 
                            className="w-3.5 h-3.5 accent-blue-500 rounded"
                            checked={isChecked}
                            onChange={(e) => {
                              const newIds = e.target.checked 
                                ? [...(editNodeForm.child_asset_ids || []), String(a.id)]
                                : (editNodeForm.child_asset_ids || []).filter(id => id !== String(a.id));
                              setEditNodeForm(prev => ({...prev, child_asset_ids: newIds}));
                            }}
                          />
                          <span className="font-semibold truncate">{a.name}</span>
                          <span className="text-[9px] text-slate-500 ml-auto font-mono">{a.ip_address}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Alerta Sonoro Quando Offline (2s) */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${editNodeForm.sound_alert_offline ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-900 text-slate-500'}`}>
                    <Bell size={16} />
                  </div>
                  <div>
                    <label className="text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer" onClick={() => setEditNodeForm(prev => ({ ...prev, sound_alert_offline: !prev.sound_alert_offline }))}>
                      Alerta Sonoro se Offline (2s)
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Toca sinal suave intercalado a cada 2 segundos quando o equipamento ficar offline.
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!editNodeForm.sound_alert_offline}
                  onChange={(e) => setEditNodeForm(prev => ({ ...prev, sound_alert_offline: e.target.checked }))}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {/* Opções de Exibição / Métricas UniFi (Para Rack ou Dispositivo Avulso) */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <label className="block text-slate-300 font-bold text-xs flex items-center gap-1.5">
                  <Activity size={14} className="text-emerald-400" />
                  {editNodeForm.icon_type === 'Rack' || editNodeForm.icon_type === 'Zone' 
                    ? "Opções de Exibição dos Itens no Rack:" 
                    : "Opções de Exibição do Dispositivo:"}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input 
                      type="checkbox" 
                      className="w-3.5 h-3.5 accent-blue-500 rounded cursor-pointer"
                      checked={editNodeForm.display_options?.show_ip ?? true}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setEditNodeForm(prev => {
                          const base = prev.display_options || prev.rack_display_options || DEFAULT_DISPLAY_OPTIONS;
                          const newOpts = { ...base, show_ip: val };
                          return {
                            ...prev,
                            display_options: newOpts,
                            rack_display_options: newOpts
                          };
                        });
                      }}
                    />
                    Mostrar Endereço IP
                  </label>

                  <div className="border-t border-slate-800 mt-2 pt-2">
                    <label className="block text-slate-400 font-bold mb-2 text-xs">Métricas UniFi (Detalhes Avançados):</label>
                    <div className="grid grid-cols-2 gap-2 pl-2">
                      {[
                        { id: 'cpu', label: 'CPU' },
                        { id: 'ram', label: 'RAM' },
                        { id: 'uptime', label: 'Uptime' },
                        { id: 'fw', label: 'Firmware' },
                        { id: 'wifi_experience', label: 'WiFi Exp. (AP)' },
                        { id: 'clients', label: 'Clientes (AP)' },
                        { id: 'channel_utilization', label: 'Uso de Canal (AP)' },
                        { id: 'lan_experience', label: 'LAN Exp. (SW)' },
                        { id: 'rx_tx', label: 'RX/TX Rates (SW)' }
                      ].map(metric => {
                        const currentMetrics = Array.isArray(editNodeForm.display_options?.unifi_metrics)
                          ? editNodeForm.display_options.unifi_metrics
                          : (Array.isArray(editNodeForm.rack_display_options?.unifi_metrics)
                          ? editNodeForm.rack_display_options.unifi_metrics
                          : DEFAULT_DISPLAY_OPTIONS.unifi_metrics);
                        const isMetricChecked = currentMetrics.includes(metric.id);
                        return (
                          <label key={metric.id} className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-400 hover:text-slate-200">
                            <input 
                              type="checkbox" 
                              className="w-3 h-3 accent-blue-500 rounded cursor-pointer"
                              checked={isMetricChecked}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setEditNodeForm(prev => {
                                  const base = prev.display_options || prev.rack_display_options || DEFAULT_DISPLAY_OPTIONS;
                                  const curr = Array.isArray(base.unifi_metrics) ? base.unifi_metrics : [...DEFAULT_DISPLAY_OPTIONS.unifi_metrics];
                                  const nextMetrics = isChecked
                                    ? (curr.includes(metric.id) ? curr : [...curr, metric.id])
                                    : curr.filter(m => m !== metric.id);
                                  const newOpts = { ...base, unifi_metrics: nextMetrics };
                                  return {
                                    ...prev,
                                    display_options: newOpts,
                                    rack_display_options: newOpts
                                  };
                                });
                              }}
                            />
                            {metric.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>




              {availableZabbixItems.length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <div className="mb-3">
                    <label className="block text-slate-300 font-black mb-1">Selecione o Grupo / Interface:</label>
                    <select
                      value={selectedZabbixInterface}
                      onChange={(e) => setSelectedZabbixInterface(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione uma interface</option>
                      {Array.from(new Set(availableZabbixItems.map(i => i.interface_name).filter(Boolean))).map(iface => (
                        <option key={iface} value={iface}>{iface}</option>
                      ))}
                      <option value="geral">Métricas Gerais / Sem Interface</option>
                    </select>
                  </div>

                  {selectedZabbixInterface && (
                    <>
                      <label className="block text-slate-300 font-black mb-2">Exibir Métricas neste Nó:</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800">
                        {availableZabbixItems
                          .filter(i => (selectedZabbixInterface === "geral" ? !i.interface_name : i.interface_name === selectedZabbixInterface))
                          .map(item => {
                            const isChecked = editNodeForm.zabbix_selected_metrics.some(m => (typeof m === 'string' ? m : m.name) === item.name);
                            const metricObj = editNodeForm.zabbix_selected_metrics.find(m => (typeof m === 'string' ? m : m.name) === item.name) || {};
                            const customLabel = typeof metricObj === 'string' ? (metricObj.split(': ').pop() || metricObj) : (metricObj.custom_label || item.name.split(': ').pop() || item.name);
                            return (
                              <div key={item.name} className="flex flex-col gap-1">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setEditNodeForm(prev => {
                                        const curr = [...prev.zabbix_selected_metrics];
                                        if (e.target.checked) curr.push({ name: item.name, custom_label: item.name.split(': ').pop() || item.name });
                                        else {
                                          const idx = curr.findIndex(m => (typeof m === 'string' ? m : m.name) === item.name);
                                          if (idx > -1) curr.splice(idx, 1);
                                        }
                                        return { ...prev, zabbix_selected_metrics: curr };
                                      });
                                    }}
                                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-blue-500/50 cursor-pointer"
                                  />
                                  <span className="text-slate-400 font-bold group-hover:text-white transition-colors text-xs">{item.name}</span>
                                </label>
                                {isChecked && (
                                  <div className="pl-6 pb-2 flex flex-col gap-1">
                                    <label className="text-[10px] text-slate-500 font-bold">Rótulo no Mapa (Personalizado):</label>
                                    <input
                                      type="text"
                                      value={customLabel}
                                      onChange={(e) => {
                                        setEditNodeForm(prev => {
                                          const curr = [...prev.zabbix_selected_metrics];
                                          const idx = curr.findIndex(m => (typeof m === 'string' ? m : m.name) === item.name);
                                          if (idx > -1) curr[idx] = { name: item.name, custom_label: e.target.value };
                                          return { ...prev, zabbix_selected_metrics: curr };
                                        });
                                      }}
                                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-blue-500 w-full"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5 font-semibold">
                        Apenas os itens marcados aparecerão dentro do bloco na topologia.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button onClick={() => { setIsEditNodeModalOpen(false); setAvailableZabbixItems([]); setSelectedZabbixInterface(""); }} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer">Cancelar</button>
              <button onClick={handleSaveEditNode} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black cursor-pointer">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Conectar Nós (Cabos) / Editar Conexão */}
      {isAddEdgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <LinkIcon size={18} className="text-purple-400" />
                {edgeEditId ? "Editar Conexão de Nós (Cabo / Link)" : "Conectar Nós (Cabo / Link)"}
              </h3>
              <button 
                onClick={() => {
                  setIsAddEdgeModalOpen(false);
                  setEdgeEditId(null);
                }} 
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Se o nó selecionado tiver múltiplas conexões, permite alternar entre elas */}
            {selectedNodeId && mapData.edges_data.filter(e => String(e.source_id) === String(selectedNodeId) || String(e.target_id) === String(selectedNodeId)).length > 1 && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 space-y-1">
                <label className="block text-slate-400 font-bold text-[11px]">
                  Conexões deste nó ({mapData.edges_data.filter(e => String(e.source_id) === String(selectedNodeId) || String(e.target_id) === String(selectedNodeId)).length}):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {mapData.edges_data
                    .filter(e => String(e.source_id) === String(selectedNodeId) || String(e.target_id) === String(selectedNodeId))
                    .map(e => {
                      const isCurrent = edgeEditId === e.id;
                      const otherNodeId = String(e.source_id) === String(selectedNodeId) ? e.target_id : e.source_id;
                      const otherNode = mapData.nodes_data.find(n => String(n.id) === String(otherNodeId));
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            setEdgeEditId(e.id);
                            setNewEdgeForm({
                              source_id: e.source_id,
                              target_id: e.target_id,
                              label: e.label || "",
                            });
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                            isCurrent
                              ? "bg-purple-600 text-white border-purple-500 shadow"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          🔗 {otherNode ? otherNode.label : "Nó"} {e.label ? `(${e.label})` : ""}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nó Origem (De):</label>
                <select
                  value={newEdgeForm.source_id}
                  onChange={(e) => setNewEdgeForm(prev => ({ ...prev, source_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500"
                >
                  <option value="">Selecione o Nó Origem...</option>
                  {mapData.nodes_data.filter(n => n.icon_type !== 'Zone').map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nó Destino (Para):</label>
                <select
                  value={newEdgeForm.target_id}
                  onChange={(e) => setNewEdgeForm(prev => ({ ...prev, target_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500"
                >
                  <option value="">Selecione o Nó Destino...</option>
                  {mapData.nodes_data.filter(n => n.icon_type !== 'Zone').map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Rótulo da Conexão / Portas (Ex: GE1/0/4, Porta 19):</label>
                <input
                  type="text"
                  placeholder="Ex: GE1/0/4 <-> GE2/0/1, Porta 19, Trunk 10G..."
                  value={newEdgeForm.label}
                  onChange={(e) => setNewEdgeForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-800">
              {edgeEditId ? (
                <button
                  type="button"
                  onClick={handleDeleteEdge}
                  className="px-3 py-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl font-bold cursor-pointer transition-colors flex items-center gap-1.5"
                  title="Excluir esta conexão"
                >
                  <Trash2 size={14} /> Excluir Cabo
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddEdgeModalOpen(false);
                    setEdgeEditId(null);
                  }} 
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleSaveEdge} 
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black cursor-pointer shadow-md shadow-purple-600/30 flex items-center gap-1.5"
                >
                  <Save size={14} />
                  {edgeEditId ? "Salvar Alterações" : "Conectar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar Novo Mapa */}
      {isNewMapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Plus size={18} className="text-emerald-400" /> Criar Novo Mapa de Topologia
              </h3>
              <button onClick={() => setIsNewMapModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nome do Mapa:</label>
                <input
                  type="text"
                  placeholder="Ex: Rede Wi-Fi 4º Andar, Topologia Servidores CPD..."
                  value={newMapForm.name}
                  onChange={(e) => setNewMapForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Descrição:</label>
                <input
                  type="text"
                  placeholder="Descrição breve do ambiente..."
                  value={newMapForm.description}
                  onChange={(e) => setNewMapForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button onClick={() => setIsNewMapModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold">Cancelar</button>
              <button onClick={handleCreateNewMap} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black">Criar Mapa</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Duplicar / Clonar Fluxograma */}
      {isCloneMapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Copy size={18} className="text-blue-400" /> Duplicar / Clonar Fluxograma
              </h3>
              <button onClick={() => setIsCloneMapModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400 text-xs">
                Cria uma cópia idêntica deste fluxograma preservando todos os racks, switches, nós, posições e conexões para facilitar a montagem de novos ambientes sem retrabalho.
              </p>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Nome do Novo Fluxograma:</label>
                <input
                  type="text"
                  placeholder="Ex: Rede 2º Andar, Topologia Switches..."
                  value={cloneMapForm.name}
                  onChange={(e) => setCloneMapForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Descrição (opcional):</label>
                <input
                  type="text"
                  placeholder="Descrição do novo diagrama..."
                  value={cloneMapForm.description}
                  onChange={(e) => setCloneMapForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button 
                type="button" 
                onClick={() => setIsCloneMapModalOpen(false)} 
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleCloneMap} 
                disabled={cloningMap || !cloneMapForm.name.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {cloningMap ? "Clonando..." : "Duplicar Fluxograma"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Criar / Editar Área ou Bloco de Agrupamento */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Layers size={18} className="text-indigo-400" />
                {zoneForm.id ? "Editar Área / Bloco" : "Nova Área / Bloco de Agrupamento"}
              </h3>
              <button onClick={() => setIsZoneModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs max-h-[65vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Nome da Área / Bloco:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Bloco ADM, Bloco UH - Apartamentos, Recepção..."
                  value={zoneForm.label}
                  onChange={(e) => setZoneForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              {/* Seletor de Cores da Área */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">
                  Cor do Contorno da Área:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(ZONE_COLOR_THEMES).map((theme) => {
                    const isSelected = (zoneForm.color || "blue") === theme.key;
                    return (
                      <button
                        key={theme.key}
                        type="button"
                        onClick={() => setZoneForm(prev => ({ ...prev, color: theme.key }))}
                        className={`px-3 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? `${theme.border} ${theme.bg} ${theme.accent} ring-2 ring-indigo-500/50`
                            : "border-slate-800 bg-slate-950 hover:bg-slate-800/60 text-slate-400"
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${theme.dot} shrink-0`} />
                        <span className="truncate">{theme.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seleção de Equipamentos que Pertencem a esta Área */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <CheckCircle size={14} className="text-indigo-400" />
                    Equipamentos Vinculados a esta Área:
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {zoneForm.selected_node_ids.length} selecionado(s)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 leading-tight">
                  Selecione os equipamentos que estarão dentro deste contorno. Se um equipamento já estiver em outra área, será transferido para esta (cada item só pode pertencer a uma área).
                </p>

                <div className="max-h-56 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1.5">
                  {mapData.nodes_data.filter(n => n.id !== zoneForm.id && n.icon_type !== 'Zone').length === 0 ? (
                    <div className="p-3 text-center text-slate-500 text-xs">
                      Nenhum equipamento adicionado neste fluxograma ainda.
                    </div>
                  ) : (
                    mapData.nodes_data
                      .filter(n => n.id !== zoneForm.id && n.icon_type !== 'Zone')
                      .map((node) => {
                        const isChecked = zoneForm.selected_node_ids.includes(node.id);
                        const otherZone = !isChecked && node.zone_id 
                          ? mapData.nodes_data.find(z => z.id === node.zone_id && z.icon_type === 'Zone')
                          : null;

                        return (
                          <label
                            key={node.id}
                            className={`flex items-center gap-2.5 text-xs p-2 rounded-xl cursor-pointer transition-all ${
                              isChecked
                                ? "bg-indigo-950/40 border border-indigo-500/40 text-white"
                                : "text-slate-300 hover:bg-slate-900 border border-transparent"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                              checked={isChecked}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setZoneForm(prev => ({
                                  ...prev,
                                  selected_node_ids: checked
                                    ? [...prev.selected_node_ids, node.id]
                                    : prev.selected_node_ids.filter(id => id !== node.id)
                                }));
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="font-bold block truncate">{node.label}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {node.ip_address || "Sem IP"} • {node.icon_type}
                              </span>
                            </div>

                            {otherZone && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
                                em: {otherZone.label}
                              </span>
                            )}
                          </label>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsZoneModalOpen(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold cursor-pointer hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveZone}
                disabled={!zoneForm.label.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
              >
                <Save size={14} />
                <span>Salvar Área</span>
              </button>
            </div>
          </div>
        </div>
      )}


    {/* Modal Planta Baixa */}
      {isFloorplanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Image size={18} className="text-amber-400" /> Definir Planta Baixa (Fundo)
              </h3>
              <button onClick={() => setIsFloorplanModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Cole a URL de uma imagem (JPG, PNG) para servir de planta baixa ou diagrama estrutural ao fundo do mapa.
              </p>
              <div>
                <label className="block text-slate-400 font-bold mb-1 text-xs">URL da Imagem:</label>
                <input
                  type="text"
                  placeholder="https://exemplo.com/planta.png"
                  value={mapData.background_image_url || ""}
                  onChange={(e) => {
                    setMapData(prev => ({ ...prev, background_image_url: e.target.value }));
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>
              
              {mapData.background_image_url && (
                <div className="mt-2 text-right">
                  <button
                    onClick={() => {
                      setMapData(prev => ({ ...prev, background_image_url: "" }));
                      setHasUnsavedChanges(true);
                    }}
                    className="text-red-400 text-xs font-bold hover:underline cursor-pointer"
                  >
                    Remover Planta Baixa
                  </button>
                </div>
              )}

              <button
                onClick={() => setIsFloorplanModalOpen(false)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-4 py-2 text-sm transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


      