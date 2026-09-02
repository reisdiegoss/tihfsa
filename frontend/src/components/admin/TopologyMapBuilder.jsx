import { useState, useEffect, useRef } from "react";
import { 
  Server, HardDrive, Wifi, Phone, Shield, Cloud, Monitor, Activity, Zap,
  Plus, Save, Trash2, Edit3, Move, RefreshCw, AlertCircle, CheckCircle, Link as LinkIcon, X, Maximize2,
  ZoomIn, ZoomOut, RotateCcw, Hand, Minimize2
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

export default function TopologyMapBuilder({ mapId, isPublicView = false, onMapLoaded }) {
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
  const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState(false);

  const [newNodeForm, setNewNodeForm] = useState({
    asset_id: "",
    child_asset_ids: [],
    label: "",
    ip_address: "",
    icon_type: "Switch", // 'Switch', 'AccessPoint', 'Phone', 'Server', 'Firewall', 'Cloud'
    x: 400,
    y: 300,
    zabbix_selected_metrics: [],
  });
  
  const [editNodeForm, setEditNodeForm] = useState({
    id: "",
    asset_id: "",
    child_asset_ids: [],
    label: "",
    ip_address: "",
    icon_type: "Switch",
    zabbix_selected_metrics: [],
  });
  const [availableZabbixItems, setAvailableZabbixItems] = useState([]);
  const [selectedZabbixInterface, setSelectedZabbixInterface] = useState("");

  // Formulário para nova conexão
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

  // Métricas ao vivo do Zabbix para exibir DENTRO dos cards
  const [liveMetrics, setLiveMetrics] = useState({});
  // Métricas do UniFi para exibir no painel de prevenção
  const [unifiMetrics, setUnifiMetrics] = useState([]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

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

  // Carga COMPLETA inicial do mapa (posições + conexões + zoom + pan)
  const fetchMapDetails = (id) => {
    if (!id) return;
    setLoading(true);
    api.get(`/network-maps/${id}`)
      .then((res) => {
        setMapData(res.data);
        if (res.data.zoom_level) setZoom(res.data.zoom_level);
        if (res.data.pan_x !== undefined && res.data.pan_y !== undefined) {
          setPan({ x: res.data.pan_x, y: res.data.pan_y });
        }
        if (res.data.assets_data && res.data.assets_data.length > 0) {
          setAssetsList((prev) => {
            const map = new Map(prev.map(a => [a.id, a]));
            res.data.assets_data.forEach(a => map.set(a.id, a));
            return Array.from(map.values());
          });
        }
        setHasUnsavedChanges(false);
        if (onMapLoaded) onMapLoaded(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  // Refresh periódico EM SEGUNDO PLANO (atualiza apenas status ICMP/Zabbix sem resetar posições ou edições do usuário)
  const refreshMapStatuses = (id) => {
    if (!id || draggingNodeId || isPanning) return;
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
      fetchMapDetails(selectedMapId);
      // Refresh de status Zabbix em segundo plano a cada 20s (sem resetar posições ou arrasto do usuário)
      const interval = setInterval(() => refreshMapStatuses(selectedMapId), 20000);
      return () => clearInterval(interval);
    }
  }, [selectedMapId]);

  // Salvar mapa atual no backend (incluindo zoom e posição pan)
  const handleSaveMap = () => {
    if (!mapData.id) return;
    setSaving(true);
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
      const isRack = n.icon_type === 'Rack' || n.icon_type === 'Zone';
      const nodeW = isRack ? 260 : 160;
      const childCount = n.child_asset_ids?.length || 0;
      const nodeH = isRack ? Math.max(160, 100 + childCount * 48) : 130;
      return {
        minX: n.x,
        maxX: n.x + nodeW,
        minY: n.y,
        maxY: n.y + nodeH
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

    setZoom(parseFloat(newZoom.toFixed(2)));
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
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

  // Adicionar Nó ao Mapa
  const handleAddNode = () => {
    const selectedAsset = assetsList.find(a => String(a.id) === String(newNodeForm.asset_id));
    
    // Calcula o centro da tela atual baseado no pan e zoom
    const container = containerRef.current;
    const cWidth = container ? container.clientWidth : 1200;
    const cHeight = container ? container.clientHeight : 750;
    const centerX = (-pan.x + cWidth / 2) / zoom - 60;
    const centerY = (-pan.y + cHeight / 2) / zoom - 45;

    const newNode = {
      id: `node_${Date.now()}`,
      asset_id: selectedAsset ? selectedAsset.id : null,
      label: newNodeForm.label || (selectedAsset ? selectedAsset.name : "Novo Equipamento"),
      icon_type: newNodeForm.icon_type,
      x: Math.round(centerX),
      y: Math.round(centerY),
      icmp_status: selectedAsset ? selectedAsset.icmp_status : "online",
      zabbix_status: selectedAsset ? selectedAsset.zabbix_status : "ok",
      zabbix_alert_title: selectedAsset ? selectedAsset.zabbix_alert_title : null,
      ip_address: newNodeForm.ip_address || (selectedAsset ? selectedAsset.ip_address : ""),
      zabbix_selected_metrics: [...newNodeForm.zabbix_selected_metrics],
      child_asset_ids: newNodeForm.child_asset_ids || [],
      rack_display_options: newNodeForm.rack_display_options || { show_ip: true, unifi_metrics: ['cpu', 'ram', 'uptime', 'fw', 'wifi_experience', 'clients', 'channel_utilization', 'lan_experience', 'rx_tx'] }
    };

    setMapData((prev) => ({
      ...prev,
      nodes_data: [...prev.nodes_data, newNode],
    }));

    setIsAddNodeModalOpen(false);
    setNewNodeForm({ asset_id: "",
    child_asset_ids: [], label: "", ip_address: "", icon_type: "Switch", x: 400, y: 300, zabbix_selected_metrics: [] });
    setAvailableZabbixItems([]);
    setSelectedZabbixInterface("");
  };

  // Abrir Modal de Edição de Nó
  const openEditNodeModal = async (nodeId) => {
    const node = mapData.nodes_data.find(n => n.id === nodeId);
    if (!node) return;
    
    setEditNodeForm({
      id: node.id,
      asset_id: node.asset_id ? String(node.asset_id) : "",
      label: node.label,
      icon_type: node.icon_type,
      zabbix_selected_metrics: node.zabbix_selected_metrics || [],
      child_asset_ids: node.child_asset_ids || [],
      rack_display_options: node.rack_display_options || { show_ip: true, unifi_metrics: ['cpu', 'ram', 'uptime', 'fw', 'wifi_experience', 'clients', 'channel_utilization', 'lan_experience', 'rx_tx'] }
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
  const handleSaveEditNode = () => {
    const selectedAsset = assetsList.find(a => String(a.id) === editNodeForm.asset_id);
    
    setHasUnsavedChanges(true);
    setMapData(prev => ({
      ...prev,
      nodes_data: prev.nodes_data.map(n => {
        if (n.id === editNodeForm.id) {
          return {
            ...n,
            asset_id: selectedAsset ? selectedAsset.id : null,
            child_asset_ids: editNodeForm.child_asset_ids || [],
            rack_display_options: editNodeForm.rack_display_options || { show_ip: true, unifi_metrics: ['cpu', 'ram', 'uptime', 'fw', 'wifi_experience', 'clients', 'channel_utilization', 'lan_experience', 'rx_tx'] },
            label: editNodeForm.label || (selectedAsset ? selectedAsset.name : n.label),
            icon_type: editNodeForm.icon_type,
            ip_address: editNodeForm.ip_address || (selectedAsset ? selectedAsset.ip_address : n.ip_address),
            zabbix_selected_metrics: [...editNodeForm.zabbix_selected_metrics],
            icmp_status: selectedAsset ? selectedAsset.icmp_status : n.icmp_status,
            zabbix_status: selectedAsset ? selectedAsset.zabbix_status : n.zabbix_status,
            zabbix_alert_title: selectedAsset ? selectedAsset.zabbix_alert_title : n.zabbix_alert_title,
          };
        }
        return n;
      }),
    }));
    
    setIsEditNodeModalOpen(false);
    setAvailableZabbixItems([]);
    setSelectedZabbixInterface("");
  };

  // Adicionar Conexão entre Nós
  const handleAddEdge = () => {
    if (!newEdgeForm.source_id || !newEdgeForm.target_id) return;
    const newEdge = {
      id: `edge_${Date.now()}`,
      source_id: newEdgeForm.source_id,
      target_id: newEdgeForm.target_id,
      label: newEdgeForm.label || "",
    };

    setMapData((prev) => ({
      ...prev,
      edges_data: [...prev.edges_data, newEdge],
    }));

    setIsAddEdgeModalOpen(false);
    setNewEdgeForm({ source_id: "", target_id: "", label: "" });
  };

  // Remover Nó Selecionado
  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setMapData((prev) => ({
      ...prev,
      nodes_data: prev.nodes_data.filter((n) => n.id !== selectedNodeId),
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
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
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
    setIsPanning(false);
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
                  title="Criar Novo Mapa de Topologia"
                >
                  <Plus size={14} />
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

            <button
              onClick={() => setIsAddNodeModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus size={15} /> Adicionar Equipamento
            </button>

            <button
              onClick={() => setIsAddEdgeModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <LinkIcon size={15} /> Conectar Nós (Cabos)
            </button>

            


            {selectedNodeId && (
              <>
                <button
                  onClick={() => openEditNodeModal(selectedNodeId)}
                  className="bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-blue-500/30"
                  title="Editar configurações deste equipamento"
                >
                  <Edit3 size={14} /> Editar Equipamento
                </button>
                <button
                  onClick={handleDeleteSelectedNode}
                  className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-red-500/30"
                  title="Excluir nó selecionado"
                >
                  <Trash2 size={14} /> Excluir Nó
                </button>
              </>
            )}

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

            {/* SVG Layer for Network Edges / Connecting Cables */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
              {mapData.edges_data.map((edge) => {
                const sourceNode = mapData.nodes_data.find(n => n.id === edge.source_id);
                const targetNode = mapData.nodes_data.find(n => n.id === edge.target_id);

                if (!sourceNode || !targetNode) return null;

                // Coordenadas centrais
                const x1 = sourceNode.x + 60;
                const y1 = sourceNode.y + 45;
                const x2 = targetNode.x + 60;
                const y2 = targetNode.y + 45;

                const isSourceOffline = sourceNode.icmp_status === "offline";
                const isTargetOffline = targetNode.icmp_status === "offline";
                const isProblemLink = isSourceOffline || isTargetOffline;

                const strokeColor = isProblemLink ? "#ef4444" : "#10b981";

                return (
                  <g key={edge.id}>
                    {/* Cable Connection Line */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={strokeColor}
                      strokeWidth={isProblemLink ? "3" : "2"}
                      strokeDasharray={isProblemLink ? "6,6" : "none"}
                      className={isProblemLink ? "animate-pulse" : ""}
                      opacity="0.85"
                    />

                    {/* Edge Label (Interface / Port Tag, ex: GE1/0/4) */}
                    {edge.label && (
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
                          opacity="0.9"
                        />
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize="9"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {edge.label}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* DOM Layer for Network Nodes / Hardware Cards */}
            <div className="absolute inset-0">
              {mapData.nodes_data.map((node) => {
                const isOffline = getIsNodeOffline(node);
                const isSelected = selectedNodeId === node.id;

                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleMouseDownNode(node.id, e)}
                    onDoubleClick={() => {
                      if (!isPublicView) {
                        openEditNodeModal(node.id);
                      }
                    }}
                    style={{ left: `${node.x}px`, top: `${node.y}px` }}
                    className={`absolute transition-all duration-150 cursor-grab active:cursor-grabbing shadow-xl ${
                      node.icon_type === 'Zone' 
                        ? "w-56 p-4 border-4 border-dashed rounded-3xl z-30 backdrop-blur-md " + (
                          isOffline ? "border-red-500 bg-red-950/80 animate-bounce" : "border-slate-500 bg-slate-800/80"
                        )
                        : node.icon_type === 'Rack' 
                        ? "w-56 p-4 border-2 rounded-xl z-30 backdrop-blur-md " + (
                          isOffline ? "border-red-500 bg-red-950/80 animate-bounce" : "border-slate-400 bg-slate-900/90 shadow-xl"
                        )
                        : "w-36 p-3 rounded-2xl border z-30 backdrop-blur-md " + (
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

                      <span className={`w-2.5 h-2.5 rounded-full ${
                        isOffline ? "bg-red-500 animate-ping" : "bg-emerald-500 animate-pulse"
                      }`} />
                    </div>

                    {/* Node Label & Subtext */}
                    <div>
                      <p className="font-extrabold text-xs text-white truncate" title={node.label}>
                        {node.label}
                      </p>
                      
                      {node.ip_address && (
                        <p className="text-[10px] font-mono text-slate-400 font-bold truncate">
                          {node.ip_address}
                        </p>
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
                              
                              const showIp = node.rack_display_options?.show_ip ?? true;
                              const unifiMetricsSelected = node.rack_display_options?.unifi_metrics ?? ['cpu', 'ram', 'uptime', 'fw', 'wifi_experience', 'clients', 'channel_utilization', 'lan_experience', 'rx_tx'];
                              
                              return (
                                <div key={cid} className={`flex flex-col gap-1.5 px-2 py-1.5 rounded-lg text-[10px] ${childOffline ? 'bg-red-900/40 border border-red-500/30' : 'bg-slate-800/60'}`}>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${childOffline ? 'bg-red-500 animate-ping' : 'bg-emerald-500'}`} />
                                    <span className="font-bold text-white truncate flex-1">{child.name}</span>
                                    {showIp && <span className="font-mono text-slate-500 text-[9px]">{child.ip_address || ''}</span>}
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
                    {node.asset_id && liveMetrics[node.asset_id] && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-700/50 pt-2">
                        {liveMetrics[node.asset_id].map((iface, idx) => {
                          // Se o usuário selecionou métricas específicas (array existe), mostramos apenas as selecionadas.
                          // Se for um nó antigo sem a prop zabbix_selected_metrics, mostramos todas (retro-compatibilidade).
                          if (node.zabbix_selected_metrics && Array.isArray(node.zabbix_selected_metrics) && node.zabbix_selected_metrics.length > 0) {
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
                    {unifiMetrics.length > 0 && node.ip_address && (
                      <UnifiMetricsBlock unifiDev={unifiMetrics.find(u => u.ip === node.ip_address)} selectedMetrics={null} />
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
                  value={editNodeForm.label}
                  onChange={(e) => setEditNodeForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-blue-500"
                />
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

                  {editNodeForm.child_asset_ids && editNodeForm.child_asset_ids.length > 0 && (
                    <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <label className="block text-slate-400 font-bold mb-2 text-xs">Exibição dos Filhos no Mapa:</label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                          <input 
                            type="checkbox" 
                            className="w-3.5 h-3.5 accent-blue-500 rounded"
                            checked={editNodeForm.rack_display_options?.show_ip ?? true}
                            onChange={(e) => {
                              setEditNodeForm(prev => ({
                                ...prev,
                                rack_display_options: {
                                  ...prev.rack_display_options,
                                  show_ip: e.target.checked
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
                            ].map(metric => (
                              <label key={metric.id} className="flex items-center gap-2 cursor-pointer text-[10px] text-slate-400 hover:text-slate-200">
                                <input 
                                  type="checkbox" 
                                  className="w-3 h-3 accent-blue-500 rounded"
                                  checked={(editNodeForm.rack_display_options?.unifi_metrics || []).includes(metric.id)}
                                  onChange={(e) => {
                                    setEditNodeForm(prev => {
                                      const currentMetrics = prev.rack_display_options?.unifi_metrics || [];
                                      return {
                                        ...prev,
                                        rack_display_options: {
                                          ...prev.rack_display_options,
                                          unifi_metrics: e.target.checked 
                                            ? [...currentMetrics, metric.id]
                                            : currentMetrics.filter(m => m !== metric.id)
                                        }
                                      };
                                    });
                                  }}
                                />
                                {metric.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}




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

      {/* Modal Conectar Nós (Cabos) */}
      {isAddEdgeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <LinkIcon size={18} className="text-purple-400" /> Conectar Nós (Cabo / Link)
              </h3>
              <button onClick={() => setIsAddEdgeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Nó Origem (De):</label>
                <select
                  value={newEdgeForm.source_id}
                  onChange={(e) => setNewEdgeForm(prev => ({ ...prev, source_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500"
                >
                  <option value="">Selecione o Nó Origem...</option>
                  {mapData.nodes_data.map((n) => (
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
                  {mapData.nodes_data.map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Rótulo da Conexão / Portas (Ex: GE1/0/4):</label>
                <input
                  type="text"
                  placeholder="Ex: GE1/0/4 <-> GE2/0/1, Trunk 10G..."
                  value={newEdgeForm.label}
                  onChange={(e) => setNewEdgeForm(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button onClick={() => setIsAddEdgeModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold">Cancelar</button>
              <button onClick={handleAddEdge} className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black">Conectar</button>
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


      