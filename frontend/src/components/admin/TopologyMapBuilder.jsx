import { useState, useEffect, useRef } from "react";
import { 
  Server, HardDrive, Wifi, Phone, Shield, Cloud, Monitor, Activity, Zap,
  Plus, Save, Trash2, Edit3, Move, RefreshCw, AlertCircle, CheckCircle, Link as LinkIcon, X, Maximize2,
  ZoomIn, ZoomOut, RotateCcw, Hand, Minimize2
} from "lucide-react";
import api from "../../api/client";

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
  const [isAddEdgeModalOpen, setIsAddEdgeModalOpen] = useState(false);
  const [isNewMapModalOpen, setIsNewMapModalOpen] = useState(false);

  // Formulário para novo nó
  const [newNodeForm, setNewNodeForm] = useState({
    asset_id: "",
    label: "",
    icon_type: "Switch", // 'Switch', 'AccessPoint', 'Phone', 'Server', 'Firewall', 'Cloud'
    x: 400,
    y: 300,
  });

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
  };

  useEffect(() => {
    fetchMaps();
    fetchAssetsAndLocations();
  }, []);

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

  // Ajustar o diagrama para caber perfeitamente na tela do usuário/TV
  const handleFitToScreen = () => {
    if (mapData.nodes_data.length === 0) return;
    const minX = Math.min(...mapData.nodes_data.map(n => n.x));
    const maxX = Math.max(...mapData.nodes_data.map(n => n.x + 160));
    const minY = Math.min(...mapData.nodes_data.map(n => n.y));
    const maxY = Math.max(...mapData.nodes_data.map(n => n.y + 110));

    const mapWidth = maxX - minX;
    const mapHeight = maxY - minY;

    const container = containerRef.current;
    const cWidth = container ? container.clientWidth : 1200;
    const cHeight = container ? container.clientHeight : 750;

    const scaleX = (cWidth - 120) / mapWidth;
    const scaleY = (cHeight - 120) / mapHeight;
    const newZoom = Math.min(1.2, Math.max(0.2, Math.min(scaleX, scaleY)));

    const newPanX = (cWidth - mapWidth * newZoom) / 2 - minX * newZoom;
    const newPanY = (cHeight - mapHeight * newZoom) / 2 - minY * newZoom;

    setZoom(parseFloat(newZoom.toFixed(2)));
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  // Gerar Diagrama de Exemplo (Presets iguais à imagem fornecida)
  const handleSeedExampleMap = () => {
    const defaultNodes = [
      { id: "node_fw", asset_id: null, label: "Firewall Core", icon_type: "Firewall", x: 260, y: 320, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_algar", asset_id: null, label: "Provedor Algar Telecom", icon_type: "Cloud", x: 80, y: 220, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_mega", asset_id: null, label: "Provedor Mega Telecom", icon_type: "Cloud", x: 80, y: 110, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_tesa", asset_id: null, label: "Provedor TESA Link", icon_type: "Cloud", x: 80, y: 440, icmp_status: "online", zabbix_status: "ok" },
      
      { id: "node_sw_core", asset_id: null, label: "Switch_Core_Huawei", icon_type: "Switch", x: 520, y: 320, icmp_status: "online", zabbix_status: "ok" },
      
      // Access Points no topo
      { id: "node_ap1", asset_id: null, label: "AP-ALPHA-NOC", icon_type: "AccessPoint", x: 380, y: 110, icmp_status: "online", zabbix_status: "problem", zabbix_alert_title: "High error rate" },
      { id: "node_ap2", asset_id: null, label: "AP_SALA_REUNIAO", icon_type: "AccessPoint", x: 500, y: 110, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_ap3", asset_id: null, label: "AP-ALPHA-OFFICE", icon_type: "AccessPoint", x: 620, y: 110, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_ap4", asset_id: null, label: "AP-ALPHA-PRESIDENTE", icon_type: "AccessPoint", x: 740, y: 110, icmp_status: "online", zabbix_status: "ok" },

      // Switch Cisco com Alerta Vermelho
      { id: "node_sw_cisco", asset_id: null, label: "Switch_Cisco_Andar", icon_type: "Switch", x: 720, y: 380, icmp_status: "online", zabbix_status: "problem", zabbix_alert_title: "Link-down alert" },

      // Telefones IP à direita
      { id: "node_tel1", asset_id: null, label: "Telefone Pregão", icon_type: "Phone", x: 920, y: 130, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_tel2", asset_id: null, label: "Telefone Sala Reunião", icon_type: "Phone", x: 920, y: 220, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_tel3", asset_id: null, label: "Telefone Financeiro", icon_type: "Phone", x: 920, y: 310, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_tel4", asset_id: null, label: "Telefone RH", icon_type: "Phone", x: 920, y: 400, icmp_status: "online", zabbix_status: "ok" },

      // Servidores no rodapé
      { id: "node_srv_zabbix", asset_id: null, label: "Servidor Zabbix NOC", icon_type: "Server", x: 720, y: 550, icmp_status: "online", zabbix_status: "ok" },
      { id: "node_videowall", asset_id: null, label: "VideoWall TV Controller", icon_type: "Server", x: 520, y: 550, icmp_status: "online", zabbix_status: "ok" },
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
    const newNode = {
      id: `node_${Date.now()}`,
      asset_id: selectedAsset ? selectedAsset.id : null,
      label: newNodeForm.label || (selectedAsset ? selectedAsset.name : "Novo Equipamento"),
      icon_type: newNodeForm.icon_type,
      x: Math.floor(Math.random() * 400) + 200,
      y: Math.floor(Math.random() * 300) + 150,
      icmp_status: selectedAsset ? selectedAsset.icmp_status : "online",
      zabbix_status: selectedAsset ? selectedAsset.zabbix_status : "ok",
      zabbix_alert_title: selectedAsset ? selectedAsset.zabbix_alert_title : null,
      ip_address: selectedAsset ? selectedAsset.ip_address : "",
    };

    setMapData((prev) => ({
      ...prev,
      nodes_data: [...prev.nodes_data, newNode],
    }));

    setIsAddNodeModalOpen(false);
    setNewNodeForm({ asset_id: "", label: "", icon_type: "Switch", x: 400, y: 300 });
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
    setZoom((prev) => parseFloat(Math.min(2.5, Math.max(0.2, prev + delta)).toFixed(2)));
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

  return (
    <div className="space-y-4">
      
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
              <button
                onClick={handleDeleteSelectedNode}
                className="bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-red-500/30"
                title="Excluir nó selecionado"
              >
                <Trash2 size={14} /> Excluir Nó
              </button>
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
        className={`bg-slate-950 border border-slate-900 rounded-3xl min-h-[750px] h-[750px] relative overflow-hidden shadow-2xl select-none ${
          isPanMode ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        
        {/* Floating Zoom & Pan Control Bar (Bottom Right) */}
        <div className="absolute bottom-4 right-4 z-40 bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 backdrop-blur-md shadow-2xl flex items-center gap-1.5 text-slate-300 text-xs">
          
          <button
            onClick={() => setZoom(prev => parseFloat(Math.min(2.5, prev + 0.15).toFixed(2)))}
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
            {/* Background Grid Lines Pattern */}
            <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#334155_1.5px,transparent_1.5px)] [background-size:28px_28px]" />

            {/* SVG Layer for Network Edges / Connecting Cables */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              {mapData.edges_data.map((edge) => {
                const sourceNode = mapData.nodes_data.find(n => n.id === edge.source_id);
                const targetNode = mapData.nodes_data.find(n => n.id === edge.target_id);

                if (!sourceNode || !targetNode) return null;

                // Coordenadas centrais
                const x1 = sourceNode.x + 60;
                const y1 = sourceNode.y + 45;
                const x2 = targetNode.x + 60;
                const y2 = targetNode.y + 45;

                const isSourceProblem = sourceNode.zabbix_status === "problem" || sourceNode.icmp_status === "offline";
                const isTargetProblem = targetNode.zabbix_status === "problem" || targetNode.icmp_status === "offline";
                const isProblemLink = isSourceProblem || isTargetProblem;

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
            <div className="absolute inset-0 z-20">
              {mapData.nodes_data.map((node) => {
                const isProblem = node.zabbix_status === "problem";
                const isOffline = node.icmp_status === "offline";
                const isSelected = selectedNodeId === node.id;

                return (
                  <div
                    key={node.id}
                    onMouseDown={(e) => handleMouseDownNode(node.id, e)}
                    style={{ left: `${node.x}px`, top: `${node.y}px` }}
                    className={`absolute w-36 p-3 rounded-2xl border transition-all duration-150 cursor-grab active:cursor-grabbing backdrop-blur-md shadow-xl ${
                      isOffline
                        ? "bg-red-950/80 border-red-500 text-white ring-4 ring-red-500/20 animate-bounce"
                        : isProblem
                        ? "bg-red-950/60 border-red-500/80 text-white ring-2 ring-red-500/30"
                        : isSelected
                        ? "bg-slate-900 border-blue-500 ring-2 ring-blue-500/40 text-white"
                        : "bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-200"
                    }`}
                  >
                    {/* Node Icon Header */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className={`p-2 rounded-xl ${
                        isProblem || isOffline ? "bg-red-500/20 border border-red-500/30" : "bg-slate-800"
                      }`}>
                        {renderNodeIcon(node.icon_type, isProblem, isOffline)}
                      </div>

                      <span className={`w-2.5 h-2.5 rounded-full ${
                        isOffline ? "bg-red-500 animate-ping" : isProblem ? "bg-amber-500 animate-pulse" : "bg-emerald-500 animate-pulse"
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

                      {/* Zabbix Alert Pill */}
                      {isProblem && (
                        <div className="mt-1.5 p-1 rounded bg-red-500/20 border border-red-500/40 text-[9px] font-black text-red-300 truncate" title={node.zabbix_alert_title}>
                          ⚠️ {node.zabbix_alert_title || "Em Alerta"}
                        </div>
                      )}
                    </div>
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

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Vincular Ativo do CMDB (Opcional):</label>
                <select
                  value={newNodeForm.asset_id}
                  onChange={(e) => {
                    const selected = assetsList.find(a => String(a.id) === e.target.value);
                    setNewNodeForm(prev => ({
                      ...prev,
                      asset_id: e.target.value,
                      label: selected ? selected.name : prev.label
                    }));
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
                </select>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button onClick={() => setIsAddNodeModalOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-bold">Cancelar</button>
              <button onClick={handleAddNode} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black">Adicionar Nó</button>
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

    </div>
  );
}
