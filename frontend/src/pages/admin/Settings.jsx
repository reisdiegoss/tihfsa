import { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon, 
  Server, 
  Users, 
  Building, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  DownloadCloud, 
  AlertCircle, 
  Activity, 
  ChevronRight,
  UserCheck,
  Search,
  Eye,
  Trash2,
  Shield,
  Briefcase,
  Edit3,
  Check,
  X,
  MapPin,
  Plus,
  Tag,
  Copy,
  Cpu,
  Layers,
  PlusCircle,
  Tv,
  Phone,
  Wifi,
  Printer,
  Monitor,
  HardDrive
} from "lucide-react";
import api from "../../api/client";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("ad");

  // Asset Types States
  const [assetTypes, setAssetTypes] = useState([]);
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(false);
  const [assetTypeSearch, setAssetTypeSearch] = useState("");
  const [assetTypeModalOpen, setAssetTypeModalOpen] = useState(false);
  const [editingAssetType, setEditingAssetType] = useState(null);
  const [savingAssetType, setSavingAssetType] = useState(false);
  const [assetTypeFormData, setAssetTypeFormData] = useState({
    name: "",
    icon: "Server",
    description: "",
    custom_fields: []
  });

  // AD States
  const [ous, setOus] = useState([]);
  const [selectedOus, setSelectedOus] = useState([]);
  const [loadingOus, setLoadingOus] = useState(false);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState(null);

  // OU Users preview modal
  const [previewOu, setPreviewOu] = useState(null);
  const [ouUsers, setOuUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [importingUser, setImportingUser] = useState(null);
  const [userSearch, setUserSearch] = useState("");

  // User Management & Permissions States
  const [systemUsers, setSystemUsers] = useState([]);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [loadingSystemUsers, setLoadingSystemUsers] = useState(false);
  const [userFilterSearch, setUserFilterSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userDeptFilter, setUserDeptFilter] = useState("all");

  // Permission Editing Modal
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState(["user"]);
  const [selectedManagedDepts, setSelectedManagedDepts] = useState([]);
  const [savingUserPermissions, setSavingUserPermissions] = useState(false);

  const [errorMsg, setErrorMsg] = useState(null);

  const fetchSystemUsers = async () => {
    setLoadingSystemUsers(true);
    try {
      const [usersRes, deptsRes] = await Promise.all([
        api.get("/users/?is_room=false"),
        api.get("/departments/")
      ]);
      setSystemUsers(usersRes.data);
      setDepartmentsList(deptsRes.data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro ao carregar lista de usuários e setores.");
    } finally {
      setLoadingSystemUsers(false);
    }
  };

  // Locations Management States
  const [locationsList, setLocationsList] = useState([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [locationFormData, setLocationFormData] = useState({
    name: "",
    floor: "",
    description: "",
    is_active: true,
  });
  const [savingLocation, setSavingLocation] = useState(false);

  const fetchLocations = async () => {
    setLoadingLocations(true);
    try {
      const res = await api.get("/locations/?active_only=false");
      setLocationsList(res.data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro ao carregar localizações.");
    } finally {
      setLoadingLocations(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      fetchSystemUsers();
    } else if (activeTab === "locations") {
      fetchLocations();
    }
  }, [activeTab]);

  const handleOpenLocationModal = (loc = null) => {
    if (loc) {
      setEditingLocation(loc);
      setLocationFormData({
        name: loc.name || "",
        floor: loc.floor || "",
        description: loc.description || "",
        is_active: loc.is_active !== undefined ? loc.is_active : true,
      });
    } else {
      setEditingLocation(null);
      setLocationFormData({
        name: "",
        floor: "",
        description: "",
        is_active: true,
      });
    }
    setLocationModalOpen(true);
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!locationFormData.name.trim()) return alert("O nome da localização é obrigatório.");
    setSavingLocation(true);
    try {
      if (editingLocation) {
        await api.patch(`/locations/${editingLocation.id}`, locationFormData);
      } else {
        await api.post("/locations/", locationFormData);
      }
      setLocationModalOpen(false);
      fetchLocations();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erro ao salvar localização.");
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (loc) => {
    if (!confirm(`Deseja realmente remover/desativar a localização '${loc.name}'?`)) return;
    try {
      await api.delete(`/locations/${loc.id}`);
      fetchLocations();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir localização.");
    }
  };

  // Problem Types & Categories States
  const [categoriesWithProblems, setCategoriesWithProblems] = useState([]);
  const [loadingCategoriesWithProblems, setLoadingCategoriesWithProblems] = useState(false);
  const [problemCategorySearch, setProblemCategorySearch] = useState("");
  const [newProblemInputs, setNewProblemInputs] = useState({});
  const [newCategoryModalOpen, setNewCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const fetchCategoriesWithProblems = async () => {
    setLoadingCategoriesWithProblems(true);
    try {
      const res = await api.get("/categories/");
      setCategoriesWithProblems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCategoriesWithProblems(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      fetchSystemUsers();
    } else if (activeTab === "locations") {
      fetchLocations();
    } else if (activeTab === "problems") {
      fetchCategoriesWithProblems();
    } else if (activeTab === "asset_types") {
      fetchAssetTypes();
    }
  }, [activeTab]);

  const fetchAssetTypes = () => {
    setLoadingAssetTypes(true);
    api.get("/asset-types/?active_only=false")
      .then(res => setAssetTypes(res.data))
      .catch(console.error)
      .finally(() => setLoadingAssetTypes(false));
  };

  const handleOpenNewAssetType = () => {
    setEditingAssetType(null);
    setAssetTypeFormData({
      name: "",
      icon: "Server",
      description: "",
      custom_fields: []
    });
    setAssetTypeModalOpen(true);
  };

  const handleOpenEditAssetType = (typeItem) => {
    setEditingAssetType(typeItem);
    setAssetTypeFormData({
      name: typeItem.name,
      icon: typeItem.icon || "Server",
      description: typeItem.description || "",
      custom_fields: typeItem.custom_fields ? typeItem.custom_fields.map(f => ({
        ...f,
        optionsStr: f.options ? f.options.join(", ") : ""
      })) : []
    });
    setAssetTypeModalOpen(true);
  };

  const handleDuplicateAssetType = async (typeItem) => {
    try {
      await api.post(`/asset-types/${typeItem.id}/duplicate`);
      fetchAssetTypes();
    } catch (err) {
      console.error(err);
      alert("Erro ao duplicar tipo de equipamento.");
    }
  };

  const handleDeleteAssetType = async (typeId, typeName) => {
    if (!window.confirm(`Tem certeza que deseja desativar o tipo de equipamento "${typeName}"?`)) return;
    try {
      await api.delete(`/asset-types/${typeId}`);
      fetchAssetTypes();
    } catch (err) {
      console.error(err);
      alert("Erro ao desativar tipo de equipamento.");
    }
  };

  const handleAddCustomField = () => {
    setAssetTypeFormData(prev => ({
      ...prev,
      custom_fields: [
        ...prev.custom_fields,
        { name: "", key: "", field_type: "text", optionsStr: "", required: false }
      ]
    }));
  };

  const handleRemoveCustomField = (index) => {
    setAssetTypeFormData(prev => ({
      ...prev,
      custom_fields: prev.custom_fields.filter((_, i) => i !== index)
    }));
  };

  const handleCustomFieldChange = (index, key, value) => {
    setAssetTypeFormData(prev => {
      const nextFields = [...prev.custom_fields];
      nextFields[index] = { ...nextFields[index], [key]: value };
      return { ...prev, custom_fields: nextFields };
    });
  };

  const handleSaveAssetType = async (e) => {
    e.preventDefault();
    if (!assetTypeFormData.name.trim()) return;
    setSavingAssetType(true);

    const formattedFields = assetTypeFormData.custom_fields.map(f => {
      const fieldKey = f.key ? f.key.trim() : f.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
      const optionsList = f.field_type === "select" && f.optionsStr
        ? f.optionsStr.split(",").map(s => s.trim()).filter(Boolean)
        : [];
      return {
        name: f.name.trim(),
        key: fieldKey,
        field_type: f.field_type,
        options: optionsList,
        required: !!f.required
      };
    });

    const payload = {
      name: assetTypeFormData.name.trim(),
      icon: assetTypeFormData.icon || "Server",
      description: assetTypeFormData.description,
      custom_fields: formattedFields
    };

    try {
      if (editingAssetType) {
        await api.put(`/asset-types/${editingAssetType.id}`, payload);
      } else {
        await api.post("/asset-types/", payload);
      }
      setAssetTypeModalOpen(false);
      fetchAssetTypes();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erro ao salvar tipo de equipamento.");
    } finally {
      setSavingAssetType(false);
    }
  };

  const handleAddProblemType = async (catId) => {
    const text = (newProblemInputs[catId] || "").trim();
    if (!text) return;
    try {
      await api.post(`/categories/${catId}/problems?name=${encodeURIComponent(text)}`);
      setNewProblemInputs(prev => ({ ...prev, [catId]: "" }));
      fetchCategoriesWithProblems();
    } catch (err) {
      console.error(err);
      alert("Erro ao adicionar tipo de problema.");
    }
  };

  const handleDeleteProblemType = async (problemId) => {
    if (!confirm("Deseja realmente remover este tipo de problema?")) return;
    try {
      await api.delete(`/categories/problems/${problemId}`);
      fetchCategoriesWithProblems();
    } catch (err) {
      console.error(err);
      alert("Erro ao remover tipo de problema.");
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      await api.post(`/categories/?name=${encodeURIComponent(newCategoryName.trim())}`);
      setNewCategoryName("");
      setNewCategoryModalOpen(false);
      fetchCategoriesWithProblems();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar categoria.");
    } finally {
      setSavingCategory(false);
    }
  };

  const fetchOus = async () => {
    setLoadingOus(true);
    setReport(null);
    setErrorMsg(null);
    try {
      const { data } = await api.get("/ad/ous");
      setOus(data);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || "Erro desconhecido";
      setErrorMsg(`Erro ao conectar ao Active Directory: ${detail}`);
    } finally {
      setLoadingOus(false);
    }
  };

  const toggleOu = (dn) => {
    if (selectedOus.includes(dn)) {
      setSelectedOus(selectedOus.filter(ou => ou !== dn));
    } else {
      setSelectedOus([...selectedOus, dn]);
    }
  };

  const selectAll = () => {
    if (selectedOus.length === ous.length) {
      setSelectedOus([]);
    } else {
      setSelectedOus(ous.map(ou => ou.dn));
    }
  };

  const handleImport = async (type = "full") => {
    if (selectedOus.length === 0) {
      return alert("Selecione pelo menos uma OU para importar.");
    }
    
    setImporting(true);
    setReport(null);
    setErrorMsg(null);
    try {
      const endpoint = type === "depts" ? "/ad/import-departments" : "/ad/import";
      const { data } = await api.post(endpoint, { ous: selectedOus });
      setReport(data.report);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || "Erro de conexão";
      setErrorMsg(`Erro ao executar a importação do AD: ${detail}`);
    } finally {
      setImporting(false);
    }
  };

  const handleResetAd = async () => {
    if (!window.confirm("Atenção: Deseja realmente ZERAR todos os setores e colaboradores importados do AD? Isso permitirá que você teste a importação do zero.")) {
      return;
    }
    setImporting(true);
    setReport(null);
    setErrorMsg(null);
    try {
      const { data } = await api.post("/ad/reset");
      alert(data.message || "Importações resetadas com sucesso.");
      setOus([]);
      setSelectedOus([]);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || "Erro de conexão";
      setErrorMsg(`Erro ao resetar dados do AD: ${detail}`);
    } finally {
      setImporting(false);
    }
  };

  const openUserPreview = async (ou) => {
    setPreviewOu(ou);
    setLoadingUsers(true);
    try {
      const { data } = await api.get(`/ad/ous/users?ou_dn=${encodeURIComponent(ou.dn)}`);
      setOuUsers(data);
    } catch (err) {
      console.error(err);
      alert("Erro ao carregar usuários da OU.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleImportSingleUser = async (user) => {
    setImportingUser(user.username);
    try {
      await api.post("/ad/import-user", {
        username: user.username,
        ou_dn: previewOu.dn
      });
      setOuUsers(prev => prev.map(u => u.username === user.username ? { ...u, imported: true } : u));
    } catch (err) {
      console.error(err);
      alert("Erro ao importar o usuário individual.");
    } finally {
      setImportingUser(null);
    }
  };

  const openPermissionModal = (u) => {
    setEditingUser(u);
    const rList = u.roles && u.roles.length > 0 ? u.roles : [u.role || "user"];
    setSelectedRoles(rList);
    setSelectedManagedDepts(u.managed_department_ids || []);
  };

  const toggleRole = (roleId) => {
    if (selectedRoles.includes(roleId)) {
      if (selectedRoles.length === 1) {
        return alert("O colaborador precisa ter pelo menos 1 papel de acesso atribuído.");
      }
      setSelectedRoles(selectedRoles.filter(r => r !== roleId));
    } else {
      setSelectedRoles([...selectedRoles, roleId]);
    }
  };

  const toggleManagedDept = (deptId) => {
    if (selectedManagedDepts.includes(deptId)) {
      setSelectedManagedDepts(selectedManagedDepts.filter(id => id !== deptId));
    } else {
      setSelectedManagedDepts([...selectedManagedDepts, deptId]);
    }
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setSavingUserPermissions(true);
    try {
      const { data } = await api.patch(`/users/${editingUser.id}`, {
        roles: selectedRoles,
        managed_department_ids: selectedRoles.includes("manager") ? selectedManagedDepts : []
      });
      alert(`Permissões de ${data.display_name} atualizadas com sucesso!`);
      setEditingUser(null);
      fetchSystemUsers();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar permissões do usuário.");
    } finally {
      setSavingUserPermissions(false);
    }
  };

  const filteredSystemUsers = systemUsers.filter(u => {
    const matchesSearch = 
      u.display_name.toLowerCase().includes(userFilterSearch.toLowerCase()) ||
      (u.ad_username && u.ad_username.toLowerCase().includes(userFilterSearch.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(userFilterSearch.toLowerCase())) ||
      (u.department_name && u.department_name.toLowerCase().includes(userFilterSearch.toLowerCase()));
    
    let matchesRole = true;
    if (userRoleFilter !== "all") {
      const uRoles = u.roles || [u.role];
      matchesRole = uRoles.some(r => r?.toLowerCase() === userRoleFilter.toLowerCase());
    }

    let matchesDept = true;
    if (userDeptFilter !== "all") {
      if (userDeptFilter === "none") {
        matchesDept = !u.department_id && !u.department_name;
      } else {
        matchesDept = u.department_id === Number(userDeptFilter) || u.department_name === userDeptFilter;
      }
    }

    return matchesSearch && matchesRole && matchesDept;
  });

  const filteredPreviewUsers = ouUsers.filter(u => 
    u.display_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in w-full max-w-[1600px] mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <SettingsIcon className="text-blue-600" size={28} /> Configurações do Sistema
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Gerencie integrações com Active Directory (OUs e Pessoas), Zabbix e preferências gerais.
          </p>
        </div>
      </div>

      {/* Modern Segmented Tabs Bar */}
      <div className="bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80 shadow-inner flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setActiveTab("ad")}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "ad"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <Server size={16} /> Importação AD
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "users"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <UserCheck size={16} /> Usuários & Permissões
        </button>

        <button
          onClick={() => setActiveTab("zabbix")}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "zabbix"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <Activity size={16} /> Integração Zabbix
        </button>

        <button
          onClick={() => setActiveTab("locations")}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "locations"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <MapPin size={16} /> Localizações Físicas
        </button>

        <button
          onClick={() => setActiveTab("problems")}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "problems"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <AlertCircle size={16} /> Tipos de Problema
        </button>

        <button
          onClick={() => setActiveTab("asset_types")}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "asset_types"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <Cpu size={16} /> Tipos de Equipamento
        </button>

        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
            activeTab === "general"
              ? "bg-white text-blue-600 shadow-sm shadow-slate-200/60 scale-[1.01]"
              : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold"
          }`}
        >
          <SettingsIcon size={16} /> Parâmetros Gerais
        </button>
      </div>

      {/* TAB CONTENT: Active Directory */}
      {activeTab === "ad" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Action Bar */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Building className="text-blue-600" size={20} /> Sincronização de Setores e Usuários (AD / LDAP)
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Conecte ao seu servidor de domínio para buscar Unidades Organizacionais (OUs), cadastrar setores e importar contas de colaboradores.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={handleResetAd}
                disabled={loadingOus || importing}
                className="flex items-center justify-center gap-2 bg-red-50 text-red-700 border border-red-200 px-4 py-3 rounded-2xl text-sm font-bold hover:bg-red-100 transition-all cursor-pointer disabled:opacity-50"
                title="Limpa setores e colaboradores importados para re-testar a importação do zero"
              >
                <Trash2 size={16} />
                Zerar Importações
              </button>

              <button
                onClick={fetchOus}
                disabled={loadingOus || importing}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={16} className={loadingOus ? "animate-spin" : ""} />
                {loadingOus ? "Carregando..." : "Buscar OUs no AD"}
              </button>
            </div>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-5 text-red-900 shadow-xs flex items-center gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">Falha de Conexão com o AD / LDAP</h3>
                <p className="text-xs font-medium text-red-700 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Report Alert */}
          {report && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 text-emerald-900 shadow-xs flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center shrink-0">
                <CheckSquare size={24} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-base">Resultado da Importação / Sincronização</h3>
                <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                  Os dados selecionados foram processados e salvos no banco local.
                </p>

                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold">
                  <span className="bg-emerald-200/60 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-300">
                    Novos Criados: {report.created}
                  </span>
                  <span className="bg-blue-100 text-blue-900 px-3 py-1.5 rounded-xl border border-blue-200">
                    Atualizados: {report.updated}
                  </span>
                  {report.deactivated !== undefined && (
                    <span className="bg-slate-200 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-300">
                      Desativados: {report.deactivated}
                    </span>
                  )}
                </div>

                {report.errors?.length > 0 && (
                  <div className="mt-4 bg-red-50 text-red-700 p-4 rounded-2xl border border-red-200 text-xs">
                    <p className="font-bold mb-1 flex items-center gap-1.5">
                      <AlertCircle size={15}/> Alertas / Observações:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 font-medium">
                      {report.errors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OUs List Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Users size={18} className="text-slate-400" />
                  Unidades Organizacionais (Setores Encontrados)
                </h2>
                {ous.length > 0 && (
                  <span className="text-xs font-extrabold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                    {ous.length} OUs
                  </span>
                )}
              </div>

              {ous.length > 0 && (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={selectAll}
                    className="text-xs font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 transition-colors"
                  >
                    {selectedOus.length === ous.length ? <CheckSquare size={14}/> : <Square size={14}/>}
                    {selectedOus.length === ous.length ? "Desmarcar Todas" : "Marcar Todas"}
                  </button>
                </div>
              )}
            </div>

            {ous.length === 0 ? (
              <div className="p-12 text-center">
                <Server size={44} className="mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-slate-700 text-base">Nenhuma OU carregada</h3>
                <p className="text-slate-500 font-semibold text-xs mt-1 max-w-md mx-auto">
                  Clique no botão "Buscar OUs no AD" acima para consultar a estrutura de diretórios do Active Directory via LDAP.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
                {ous.map((ou) => {
                  const isSelected = selectedOus.includes(ou.dn);
                  return (
                    <div 
                      key={ou.dn}
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors group"
                    >
                      <div 
                        onClick={() => toggleOu(ou.dn)}
                        className="flex items-center gap-3.5 flex-1 cursor-pointer"
                      >
                        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                          isSelected 
                            ? "bg-blue-600 border-blue-600 text-white" 
                            : "border-slate-300 text-transparent group-hover:border-blue-400"
                        }`}>
                          <CheckSquare size={16} className={isSelected ? "opacity-100" : "opacity-0"} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            {ou.name}
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              OU / Setor
                            </span>
                          </p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5 break-all">{ou.dn}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => openUserPreview(ou)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:text-slate-900 text-xs font-bold transition-all cursor-pointer shrink-0"
                        title="Ver Pessoas / Usuários nesta OU"
                      >
                        <Eye size={14} className="text-slate-400" />
                        Ver Pessoas
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Actions Bar */}
            {ous.length > 0 && (
              <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs font-bold text-slate-600">
                  <span className="text-blue-600 font-extrabold">{selectedOus.length}</span> de {ous.length} OUs selecionadas
                </span>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => handleImport("depts")}
                    disabled={importing || selectedOus.length === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 px-5 py-2.5 rounded-2xl text-xs font-bold shadow-xs hover:bg-slate-100 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Building size={16} className="text-slate-500" />
                    Importar Apenas Setores
                  </button>

                  <button
                    onClick={() => handleImport("full")}
                    disabled={importing || selectedOus.length === 0}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-2xl text-xs font-bold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <DownloadCloud size={16} />
                    {importing ? "Importando..." : "Importar Setores + Pessoas"}
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB CONTENT: Usuários e Permissões */}
      {activeTab === "users" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header & Controls Bar */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <UserCheck className="text-blue-600" size={20} /> Gestão de Papéis e Permissões de Usuários
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Defina atendentes, gerentes de setor e administradores. Gerentes podem acompanhar chamados de múltiplos setores.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={userFilterSearch}
                  onChange={(e) => setUserFilterSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>

              {/* Role Filter */}
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Todos os Papéis</option>
                <option value="admin">Administradores</option>
                <option value="technician">Atendentes / Técnicos</option>
                <option value="manager">Gerentes de Setor</option>
                <option value="user">Solicitantes</option>
              </select>

              {/* Department Filter */}
              <select
                value={userDeptFilter}
                onChange={(e) => setUserDeptFilter(e.target.value)}
                className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">Todos os Setores</option>
                <option value="none">Geral / Não atribuído</option>
                {departmentsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <button
                onClick={fetchSystemUsers}
                disabled={loadingSystemUsers}
                className="p-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors shrink-0 cursor-pointer"
                title="Atualizar lista"
              >
                <RefreshCw size={16} className={loadingSystemUsers ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            {loadingSystemUsers ? (
              <div className="p-12 text-center text-slate-400 font-semibold text-sm flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin text-blue-600" /> Carregando lista de colaboradores...
              </div>
            ) : filteredSystemUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-semibold text-sm">
                Nenhum colaborador encontrado com os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-6 whitespace-nowrap">Colaborador / Usuário</th>
                      <th className="py-3.5 px-6 whitespace-nowrap">Setor Pertencente</th>
                      <th className="py-3.5 px-6 whitespace-nowrap">Papel / Nível de Acesso</th>
                      <th className="py-3.5 px-6 whitespace-nowrap">Setores Sob Gerência</th>
                      <th className="py-3.5 px-6 text-right whitespace-nowrap">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {filteredSystemUsers.map((u) => {
                      const uRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role || "user"];
                      const isManager = uRoles.some(r => r.toLowerCase() === "manager" || r.toLowerCase() === "gerente");

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6">
                            <div>
                              <p className="font-bold text-slate-900 text-sm whitespace-nowrap">{u.display_name}</p>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5 whitespace-nowrap">
                                @{u.ad_username || `user_${u.id}`} {u.email && `• ${u.email}`}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-6 whitespace-nowrap">
                            <span className="inline-block bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-bold border border-slate-200 whitespace-nowrap">
                              {u.department_name || "Geral / Não atribuído"}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-1">
                              {uRoles.map((r, rIdx) => {
                                const rLower = r.toLowerCase();
                                if (rLower === "admin") {
                                  return (
                                    <span key={rIdx} className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap">
                                      <Shield size={12} /> Admin
                                    </span>
                                  );
                                } else if (rLower === "technician" || rLower === "tecnico") {
                                  return (
                                    <span key={rIdx} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap">
                                      🛠️ Atendente (TI)
                                    </span>
                                  );
                                } else if (rLower === "manager" || rLower === "gerente") {
                                  return (
                                    <span key={rIdx} className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap">
                                      👔 Gerente
                                    </span>
                                  );
                                }
                                return (
                                  <span key={rIdx} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold whitespace-nowrap">
                                    👤 Solicitante
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {isManager ? (
                              u.managed_department_names && u.managed_department_names.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {u.managed_department_names.map((name, idx) => (
                                    <span key={idx} className="bg-amber-100/70 text-amber-900 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Nenhum setor atribuído</span>
                              )
                            ) : (
                              <span className="text-slate-300 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={() => openPermissionModal(u)}
                              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              <Edit3 size={14} /> Editar Permissões
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB CONTENT: Zabbix */}
      {activeTab === "zabbix" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold">
                <Activity size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Integração Zabbix Monitoring</h2>
                <p className="text-xs font-semibold text-slate-500">Sincronização de Hosts, IPs e Alertas de Infraestrutura em Tempo Real</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 font-medium leading-relaxed mb-6">
              O sistema TIHFSA está integrado diretamente via API com o Zabbix. Você pode gerenciar os ativos detectados e importar hosts não cadastrados diretamente na tela dedicada de Monitoramento.
            </p>

            <a
              href="/admin/zabbix"
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-md transition-all"
            >
              Ir para Painel do Zabbix & Auto-Discovery
              <ChevronRight size={16} />
            </a>
          </div>
        </div>
      )}

      {/* TAB CONTENT: General */}
      {activeTab === "general" && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Parâmetros Gerais do TIHFSA</h2>
            <p className="text-xs font-semibold text-slate-500 mb-6">Configurações globais do sistema do Fasano Salvador</p>

            <div className="space-y-4 max-w-xl">
              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Nome da Unidade</label>
                <input
                  type="text"
                  disabled
                  value="Hotel Fasano Salvador"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Servidor LDAP Ativo</label>
                <input
                  type="text"
                  disabled
                  value="ad.fasano.local (Porta 389)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Preview Users in OU */}
      {previewOu && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-scale-up">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <UserCheck className="text-blue-600" size={20} />
                  Pessoas / Usuários no AD
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5 truncate max-w-md">
                  {previewOu.name} ({previewOu.dn})
                </p>
              </div>

              <button
                onClick={() => { setPreviewOu(null); setOuUsers([]); setUserSearch(""); }}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-white">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar por nome, usuário ou e-mail..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-6 max-h-[380px] overflow-y-auto divide-y divide-slate-100">
              {loadingUsers ? (
                <div className="p-8 text-center text-slate-500 font-semibold text-sm flex items-center justify-center gap-2">
                  <RefreshCw size={18} className="animate-spin text-blue-600" />
                  Consultando usuários no Active Directory...
                </div>
              ) : filteredPreviewUsers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 font-medium text-sm">
                  Nenhum usuário encontrado nesta OU.
                </div>
              ) : (
                filteredPreviewUsers.map((u, i) => (
                  <div key={i} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{u.display_name}</p>
                      <p className="text-xs text-slate-400 font-semibold flex items-center gap-2 mt-0.5 truncate">
                        <span>@{u.username}</span>
                        {u.email && <span className="truncate">• {u.email}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 hidden sm:inline-block">
                        {u.department || "Setor Geral"}
                      </span>

                      {u.imported ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                          <CheckSquare size={14} /> Importado
                        </span>
                      ) : (
                        <button
                          onClick={() => handleImportSingleUser(u)}
                          disabled={importingUser === u.username}
                          className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          {importingUser === u.username ? (
                            <RefreshCw size={14} className="animate-spin" />
                          ) : (
                            <DownloadCloud size={14} />
                          )}
                          Importar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => { setPreviewOu(null); setOuUsers([]); setUserSearch(""); }}
                className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Editar Permissões do Colaborador */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-scale-up">
            
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Shield className="text-blue-600" size={20} />
                  Permissões de {editingUser.display_name}
                </h3>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">
                  Setor Pertencente: {editingUser.department_name || "Sem setor registrado"} • @{editingUser.ad_username || `user_${editingUser.id}`}
                </p>
              </div>

              <button
                onClick={() => setEditingUser(null)}
                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              
              {/* Role Selection (Multi-Role Checkboxes) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">
                    Papéis e Níveis de Acesso (Múltipla Seleção)
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                    {selectedRoles.length} selecionado(s)
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mb-3">
                  Você pode atribuir múltiplos papéis para o mesmo colaborador (ex: Solicitante + Gerente de Setor).
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: "user", label: "Solicitante", desc: "Abre e visualiza os próprios chamados", icon: "👤" },
                    { id: "technician", label: "Atendente (TI)", desc: "Abre, atende, responde e finaliza chamados", icon: "🛠️" },
                    { id: "manager", label: "Gerente de Setor", desc: "Acompanha chamados dos setores gerenciados", icon: "👔" },
                    { id: "admin", label: "Administrador", desc: "Acesso total a relatórios, AD, Zabbix e configurações", icon: "🛡️" },
                  ].map((roleOpt) => {
                    const isChecked = selectedRoles.includes(roleOpt.id);
                    return (
                      <button
                        key={roleOpt.id}
                        type="button"
                        onClick={() => toggleRole(roleOpt.id)}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                          isChecked
                            ? "border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <span>{roleOpt.icon}</span> {roleOpt.label}
                          </span>
                          {isChecked ? (
                            <CheckSquare size={18} className="text-blue-600 shrink-0" />
                          ) : (
                            <Square size={18} className="text-slate-300 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          {roleOpt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Managed Departments Selection (Visible when role 'manager' is checked) */}
              {selectedRoles.includes("manager") && (
                <div className="space-y-3 bg-amber-50/50 border border-amber-200/80 rounded-2xl p-5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Briefcase size={15} /> Setores Sob Gerência ({selectedManagedDepts.length} selecionados)
                    </label>
                  </div>
                  <p className="text-xs text-amber-700 font-medium">
                    Marque os setores que este gerente poderá visualizar e acompanhar no portal.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    {departmentsList.map((d) => {
                      const isChecked = selectedManagedDepts.includes(d.id);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => toggleManagedDept(d.id)}
                          className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            isChecked
                              ? "bg-amber-100/80 border-amber-400 text-amber-950 font-bold shadow-xs"
                              : "bg-white border-slate-200 text-slate-700 hover:border-amber-300 font-semibold"
                          }`}
                        >
                          <span className="text-xs truncate">{d.name}</span>
                          {isChecked ? (
                            <CheckSquare size={16} className="text-amber-700 shrink-0" />
                          ) : (
                            <Square size={16} className="text-slate-300 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingUserPermissions}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {savingUserPermissions ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                Salvar Permissões
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB CONTENT: Localizações Físicas */}
      {activeTab === "locations" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Bar */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="text-blue-600" size={20} /> Cadastros de Localizações Físicas
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Cadastre salas, andares, UHs e racks para mapear a localização exata de cada ativo no CMDB.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => handleOpenLocationModal()}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer"
              >
                <Plus size={18} /> Nova Localização
              </button>
            </div>
          </div>

          {/* Search & Counter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Pesquisar por nome, andar ou descrição..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="text-xs font-bold text-slate-500 px-2">
              Total: <span className="text-slate-900 font-extrabold">{locationsList.length}</span> localizações cadastradas
            </div>
          </div>

          {/* Locations Table */}
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
            {loadingLocations ? (
              <div className="p-12 text-center text-slate-400 font-semibold space-y-3">
                <RefreshCw size={24} className="animate-spin mx-auto text-blue-600" />
                <p className="text-xs">Carregando localizações...</p>
              </div>
            ) : locationsList.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-semibold space-y-3">
                <MapPin size={36} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-600">Nenhuma localização cadastrada.</p>
                <p className="text-xs text-slate-400">Clique em "Nova Localização" para adicionar a primeira área física.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-4 px-6">Nome da Localização</th>
                      <th className="py-4 px-4">Andar / Nível</th>
                      <th className="py-4 px-4">Ativos Vinculados</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                    {locationsList
                      .filter(loc => {
                        if (!locationSearch) return true;
                        const term = locationSearch.toLowerCase();
                        return (
                          loc.name.toLowerCase().includes(term) ||
                          (loc.floor && loc.floor.toLowerCase().includes(term)) ||
                          (loc.description && loc.description.toLowerCase().includes(term))
                        );
                      })
                      .map((loc) => (
                        <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 px-6 font-extrabold text-slate-900">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                                <MapPin size={16} />
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-900">{loc.name}</p>
                                {loc.description && <p className="text-[11px] font-medium text-slate-400 truncate max-w-xs">{loc.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            {loc.floor ? (
                              <span className="font-bold text-slate-800">{loc.floor}</span>
                            ) : (
                              <span className="text-slate-300 italic">—</span>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold ${
                              loc.asset_count > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                            }`}>
                              {loc.asset_count} ativo{loc.asset_count !== 1 ? "s" : ""}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {loc.is_active ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ativo
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Inativo
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenLocationModal(loc)}
                                className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Editar Localização"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteLocation(loc)}
                                className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Excluir ou Desativar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Nova / Editar Localização */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <MapPin className="text-blue-600" size={20} />
                {editingLocation ? "Editar Localização" : "Nova Localização Física"}
              </h3>
              <button
                onClick={() => setLocationModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Nome da Localização <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Recepção, Racks TI, UH 101, Bar Cobertura"
                  value={locationFormData.name}
                  onChange={(e) => setLocationFormData({ ...locationFormData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Andar / Nível
                </label>
                <input
                  type="text"
                  placeholder="Ex: Térreo, 1º Andar, 2º Andar, Subsolo, Cobertura"
                  value={locationFormData.floor}
                  onChange={(e) => setLocationFormData({ ...locationFormData, floor: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Descrição / Observações
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalhes adicionais sobre os equipamentos ou acesso a esta área..."
                  value={locationFormData.description}
                  onChange={(e) => setLocationFormData({ ...locationFormData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={locationFormData.is_active}
                    onChange={(e) => setLocationFormData({ ...locationFormData, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Localização Ativa</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(false)}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingLocation ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingLocation ? "Salvar Alterações" : "Cadastrar Localização"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB CONTENT: Tipos de Problema por Categoria */}
      {activeTab === "problems" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Bar */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle className="text-blue-600" size={20} /> Cadastro de Tipos de Problema por Categoria
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Cadastre os problemas predefinidos que aparecem para seleção ao abrir um chamado técnico.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setNewCategoryModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer"
              >
                <Plus size={18} /> Nova Categoria
              </button>
            </div>
          </div>

          {/* Search & Counter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Pesquisar categoria ou problema..."
                value={problemCategorySearch}
                onChange={(e) => setProblemCategorySearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="text-xs font-bold text-slate-500 px-2">
              Total: <span className="text-slate-900 font-extrabold">{categoriesWithProblems.length}</span> categorias ativas
            </div>
          </div>

          {/* Category & Problems Grid */}
          {loadingCategoriesWithProblems ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-semibold space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-blue-600" />
              <p className="text-xs">Carregando categorias e tipos de problemas...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoriesWithProblems
                .filter(cat => {
                  if (!problemCategorySearch) return true;
                  const term = problemCategorySearch.toLowerCase();
                  const catMatch = cat.name.toLowerCase().includes(term);
                  const probMatch = cat.problem_types?.some(pt => pt.name.toLowerCase().includes(term));
                  return catMatch || probMatch;
                })
                .map((cat) => (
                  <div key={cat.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      {/* Header da Categoria */}
                      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                            <Tag size={16} />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm">{cat.name}</h3>
                            <p className="text-[10px] font-semibold text-slate-400">
                              {cat.problem_types?.length || 0} problema(s) cadastrado(s)
                            </p>
                          </div>
                        </div>

                        {cat.zabbix_group_name && (
                          <span className="text-[10px] font-extrabold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full border border-purple-100 shrink-0">
                            Zabbix: {cat.zabbix_group_name}
                          </span>
                        )}
                      </div>

                      {/* Lista de Tipos de Problema como Chips */}
                      <div className="mt-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                          Problemas Reportados Predefinidos
                        </label>
                        {(!cat.problem_types || cat.problem_types.length === 0) ? (
                          <p className="text-xs italic text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            Nenhum problema específico cadastrado ainda.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {cat.problem_types.map((pt) => (
                              <div
                                key={pt.id}
                                className="group/chip inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 text-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-200/60"
                              >
                                <span>{pt.name}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProblemType(pt.id)}
                                  className="text-slate-400 hover:text-red-600 transition-colors p-0.5 rounded-full cursor-pointer opacity-70 group-hover/chip:opacity-100"
                                  title="Remover este tipo de problema"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Campo para Adicionar Novo Problema Direto na Categoria */}
                    <div className="pt-3 border-t border-slate-100">
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddProblemType(cat.id);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          placeholder="Digite um novo problema (ex: Equipamento não liga)..."
                          value={newProblemInputs[cat.id] || ""}
                          onChange={(e) => setNewProblemInputs({ ...newProblemInputs, [cat.id]: e.target.value })}
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                        />
                        <button
                          type="submit"
                          disabled={!newProblemInputs[cat.id]?.trim()}
                          className="px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-40 transition-colors shrink-0 cursor-pointer flex items-center gap-1 shadow-xs"
                        >
                          <Plus size={14} /> Add
                        </button>
                      </form>
                    </div>

                  </div>
                ))}
            </div>
          )}

        </div>
      )}

      {/* TAB CONTENT: Tipos de Equipamento e Campos Personalizados */}
      {activeTab === "asset_types" && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Header Bar */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Cpu className="text-blue-600" size={20} /> Cadastros Dinâmicos de Tipos de Equipamento
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Configure os tipos de ativos (Servidores, Antenas, Ramais) e adicione campos especiais dinâmicos para cada perfil.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleOpenNewAssetType}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer"
              >
                <Plus size={18} /> Novo Tipo de Equipamento
              </button>
            </div>
          </div>

          {/* Search & Counter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Pesquisar tipo de equipamento ou campo especial..."
                value={assetTypeSearch}
                onChange={(e) => setAssetTypeSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all"
              />
            </div>
            <div className="text-xs font-bold text-slate-500 px-2">
              Total: <span className="text-slate-900 font-extrabold">{assetTypes.length}</span> tipos configurados
            </div>
          </div>

          {/* Grid de Tipos de Equipamento */}
          {loadingAssetTypes ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-semibold space-y-3">
              <RefreshCw size={24} className="animate-spin mx-auto text-blue-600" />
              <p className="text-xs">Carregando tipos de equipamento e campos personalizados...</p>
            </div>
          ) : assetTypes.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-semibold space-y-3">
              <Cpu size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">Nenhum tipo de equipamento cadastrado.</p>
              <p className="text-xs text-slate-400">Clique no botão acima para cadastrar o primeiro perfil de equipamento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assetTypes
                .filter(t => {
                  if (!assetTypeSearch) return true;
                  const term = assetTypeSearch.toLowerCase();
                  const nameMatch = t.name.toLowerCase().includes(term);
                  const descMatch = (t.description || "").toLowerCase().includes(term);
                  const fieldMatch = t.custom_fields?.some(f => f.name.toLowerCase().includes(term));
                  return nameMatch || descMatch || fieldMatch;
                })
                .map((typeItem) => (
                  <div key={typeItem.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      {/* Header do Card */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                            <Cpu size={20} />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                              {typeItem.name}
                              {!typeItem.is_active && (
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">Inativo</span>
                              )}
                            </h3>
                            <p className="text-xs font-semibold text-slate-400 line-clamp-1">
                              {typeItem.description || "Perfil de equipamento sem descrição"}
                            </p>
                          </div>
                        </div>

                        {/* Botões de Ação: Editar, Duplicar, Desativar */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleDuplicateAssetType(typeItem)}
                            className="flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                            title="Duplicar este cadastro com todos os campos dinâmicos"
                          >
                            <Copy size={13} />
                            <span>Duplicar</span>
                          </button>
                          <button
                            onClick={() => handleOpenEditAssetType(typeItem)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                            title="Editar Tipo e Campos"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteAssetType(typeItem.id, typeItem.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            title="Desativar Tipo"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Lista de Campos Personalizados Configurados */}
                      <div className="mt-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                          Campos Especiais Dinâmicos ({typeItem.custom_fields?.length || 0})
                        </label>

                        {(!typeItem.custom_fields || typeItem.custom_fields.length === 0) ? (
                          <p className="text-xs italic text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            Nenhum campo personalizado associado. Usará apenas informações básicas.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {typeItem.custom_fields.map((field, fIdx) => (
                              <div key={fIdx} className="bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl flex items-center justify-between text-xs">
                                <div>
                                  <p className="font-extrabold text-slate-800">{field.name}</p>
                                  <p className="text-[10px] font-semibold text-slate-400">
                                    Tipo: <span className="text-slate-600 uppercase font-mono">{field.field_type}</span>
                                    {field.options && field.options.length > 0 && ` (${field.options.length} opções)`}
                                  </p>
                                </div>
                                {field.required && (
                                  <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-extrabold border border-amber-200">
                                    Obrigatório
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

        </div>
      )}

      {/* MODAL: Criar / Editar Tipo de Equipamento */}
      {assetTypeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Cpu className="text-blue-600" size={20} />
                {editingAssetType ? `Editar Tipo: ${editingAssetType.name}` : "Novo Tipo de Equipamento"}
              </h3>
              <button
                onClick={() => setAssetTypeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveAssetType} className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Nome do Tipo de Equipamento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Servidor Linux, Antena UniFi, Telefone IP"
                    value={assetTypeFormData.name}
                    onChange={(e) => setAssetTypeFormData({ ...assetTypeFormData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Descrição Curta
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Equipamentos de rede de alto desempenho"
                    value={assetTypeFormData.description}
                    onChange={(e) => setAssetTypeFormData({ ...assetTypeFormData, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Construtor Dinâmico de Campos Especiais */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Layers size={14} className="text-blue-600" /> Características & Campos Personalizados
                    </h4>
                    <p className="text-[11px] font-semibold text-slate-400">
                      Adicione campos especiais que deverão ser preenchidos ao cadastrar este tipo de equipamento.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 px-3.5 py-2 rounded-xl text-xs font-extrabold transition-colors cursor-pointer shrink-0"
                  >
                    <PlusCircle size={14} /> + Adicionar Campo Especial
                  </button>
                </div>

                {assetTypeFormData.custom_fields.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-400 text-xs font-semibold">
                    Nenhum campo personalizado adicionado ainda. Clique no botão acima para adicionar.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assetTypeFormData.custom_fields.map((field, idx) => (
                      <div key={idx} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3 relative group">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                              Nome do Campo <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Ex: Memória RAM, Ramal, SSID"
                              value={field.name}
                              onChange={(e) => handleCustomFieldChange(idx, "name", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                              Tipo do Campo
                            </label>
                            <select
                              value={field.field_type}
                              onChange={(e) => handleCustomFieldChange(idx, "field_type", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="text">Texto Livre</option>
                              <option value="number">Número</option>
                              <option value="select">Lista de Seleção (Dropdown)</option>
                              <option value="boolean">Sim / Não (Checkbox)</option>
                            </select>
                          </div>

                          <div className="flex items-center justify-between pt-4 sm:pt-0">
                            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => handleCustomFieldChange(idx, "required", e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                              />
                              <span>Obrigatório</span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleRemoveCustomField(idx)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                              title="Remover este campo"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>

                        {field.field_type === "select" && (
                          <div className="pt-2 border-t border-slate-200/60">
                            <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1">
                              Opções da Lista (separadas por vírgula)
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: 2.4 GHz, 5 GHz, Dual-Band"
                              value={field.optionsStr || ""}
                              onChange={(e) => handleCustomFieldChange(idx, "optionsStr", e.target.value)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setAssetTypeModalOpen(false)}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAssetType || !assetTypeFormData.name.trim()}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingAssetType ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingAssetType ? "Salvar Alterações" : "Cadastrar Tipo de Equipamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Nova Categoria */}
      {newCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Tag className="text-blue-600" size={20} /> Nova Categoria
              </h3>
              <button
                onClick={() => setNewCategoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Nome da Categoria <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Impressoras, PABX, Sistemas"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setNewCategoryModalOpen(false)}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCategory || !newCategoryName.trim()}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingCategory ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  Criar Categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
