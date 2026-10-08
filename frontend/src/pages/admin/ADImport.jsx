import { useState, useEffect } from "react";
import { 
  Users, 
  Server, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  DownloadCloud, 
  AlertCircle, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  UserCheck, 
  UserPlus, 
  FolderTree, 
  Layers, 
  ArrowRight,
  Building2,
  Tag,
  Search,
  Check,
  RotateCcw,
  X
} from "lucide-react";
import api from "../../api/client";

export default function ADImport() {
  const [ous, setOus] = useState([]);
  const [selectedOus, setSelectedOus] = useState([]);
  const [ouMappings, setOuMappings] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState(null);

  // Estados de expansão e usuários das OUs
  const [expandedOus, setExpandedOus] = useState({});
  const [ouUsers, setOuUsers] = useState({});
  const [loadingOuUsers, setLoadingOuUsers] = useState({});
  const [importingUser, setImportingUser] = useState({});

  const fetchOus = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data } = await api.get("/ad/ous");
      setOus(data);

      // Inicializa os mapeamentos sugeridos
      const initialMappings = {};
      data.forEach((ou) => {
        initialMappings[ou.dn] = ou.suggested_group || ou.name;
      });
      setOuMappings(initialMappings);
    } catch (err) {
      console.error(err);
      alert("Erro ao buscar OUs. Verifique a conexão com o LDAP.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOus();
  }, []);

  const handleResetAd = async () => {
    if (!window.confirm("Atenção: Deseja realmente ZERAR todos os setores e colaboradores importados do AD? Isso permitirá que você reimporte do zero com os setores corretos.")) {
      return;
    }
    setSyncing(true);
    setReport(null);
    try {
      const { data } = await api.post("/ad/reset");
      alert(data.message || "Dados do AD resetados com sucesso!");
      fetchOus();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || "Erro de conexão";
      alert(`Erro ao resetar dados do AD: ${detail}`);
    } finally {
      setSyncing(false);
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
    const visibleDns = filteredOus.map(ou => ou.dn);
    const allSelected = visibleDns.every(dn => selectedOus.includes(dn));
    if (allSelected) {
      setSelectedOus(selectedOus.filter(dn => !visibleDns.includes(dn)));
    } else {
      setSelectedOus(Array.from(new Set([...selectedOus, ...visibleDns])));
    }
  };

  const handleMappingChange = (dn, value) => {
    setOuMappings(prev => ({
      ...prev,
      [dn]: value
    }));
  };

  const toggleExpandOu = async (dn) => {
    const isCurrentlyExpanded = !!expandedOus[dn];
    setExpandedOus(prev => ({ ...prev, [dn]: !isCurrentlyExpanded }));

    // Se estiver abrindo e ainda não tiver carregado os usuários da OU
    if (!isCurrentlyExpanded && !ouUsers[dn]) {
      setLoadingOuUsers(prev => ({ ...prev, [dn]: true }));
      try {
        const { data } = await api.get(`/ad/ous/users?ou_dn=${encodeURIComponent(dn)}`);
        setOuUsers(prev => ({ ...prev, [dn]: data }));
      } catch (err) {
        console.error("Erro ao carregar colaboradores da OU:", err);
      } finally {
        setLoadingOuUsers(prev => ({ ...prev, [dn]: false }));
      }
    }
  };

  const handleImportSingleUser = async (user, ouDn) => {
    const targetDept = ouMappings[ouDn] || user.department;
    setImportingUser(prev => ({ ...prev, [user.username]: true }));
    try {
      const { data } = await api.post("/ad/import-user", {
        username: user.username,
        ou_dn: ouDn,
        target_dept_name: targetDept
      });
      alert(data.message || `Colaborador ${user.display_name} importado com sucesso!`);
      // Atualizar lista local de usuários
      setOuUsers(prev => ({
        ...prev,
        [ouDn]: (prev[ouDn] || []).map(u => u.username === user.username ? { ...u, imported: true } : u)
      }));
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || "Erro ao importar usuário";
      alert(`Falha ao importar usuário: ${detail}`);
    } finally {
      setImportingUser(prev => ({ ...prev, [user.username]: false }));
    }
  };

  const handleImport = async (departmentsOnly = false) => {
    if (selectedOus.length === 0) {
      alert("Selecione pelo menos uma OU para importar.");
      return;
    }
    
    setSyncing(true);
    setReport(null);
    try {
      const endpoint = departmentsOnly ? "/ad/import-departments" : "/ad/import";
      const { data } = await api.post(endpoint, { 
        ous: selectedOus,
        ou_mappings: ouMappings
      });
      setReport(data.report);
      alert(departmentsOnly ? "Setores importados com sucesso!" : "Importação de setores e colaboradores concluída com sucesso!");
      
      // Limpa cache de usuários de OUs abertas para refletir novas importações
      setOuUsers({});
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || "Erro na importação";
      alert(`Erro ao sincronizar dados com o AD: ${detail}`);
    } finally {
      setSyncing(false);
    }
  };

  const filteredOus = ous.filter(ou => 
    ou.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ou.dn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ou.suggested_group && ou.suggested_group.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-16 animate-fade-in max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Server className="text-blue-600" /> Sincronização Active Directory
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-1">
            Importe setores e colaboradores agrupando sub-OUs de forma inteligente ou personalizando o setor destino.
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetAd}
            disabled={loading || syncing}
            className="flex items-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 px-3.5 py-2 rounded-xl border border-red-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            title="Limpar e resetar setores e usuários do AD para reimportar"
          >
            <Trash2 size={15} />
            Resetar Dados do AD
          </button>
          <button
            onClick={fetchOus}
            disabled={loading || syncing}
            className="flex items-center gap-2 bg-white text-slate-700 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold shadow-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-blue-600" : ""} />
            Buscar OUs
          </button>
        </div>
      </div>

      {/* Relatório de Importação */}
      {report && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-4 text-emerald-800 animate-in fade-in duration-200">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <CheckSquare size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">Resumo da Sincronização</h3>
            <div className="mt-2 text-xs font-semibold flex flex-wrap gap-3">
              <span className="bg-emerald-200/50 px-2.5 py-1 rounded-lg text-emerald-900">
                Criados: <strong>{report.created}</strong>
              </span>
              <span className="bg-blue-100 px-2.5 py-1 rounded-lg text-blue-800">
                Atualizados: <strong>{report.updated}</strong>
              </span>
              <span className="bg-slate-200/60 px-2.5 py-1 rounded-lg text-slate-800">
                Desativados: <strong>{report.deactivated}</strong>
              </span>
            </div>
            {report.errors?.length > 0 && (
              <div className="mt-3 bg-red-50 text-red-700 p-3 rounded-xl border border-red-100 text-xs font-medium">
                <p className="font-bold mb-1 flex items-center gap-1"><AlertCircle size={14}/> Avisos/Erros:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {report.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card Principal de OUs */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Barra de Filtro e Seleção Rápida */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderTree size={18} className="text-blue-600" />
            <h2 className="font-bold text-slate-800 text-sm">
              Estrutura de OUs no Active Directory
            </h2>
            <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              {ous.length} OUs
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar por nome de OU ou grupo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl pl-8 pr-7 py-1.5 text-xs outline-none focus:border-blue-500 w-64"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Limpar busca"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-colors"
                title="Limpar filtro de busca"
              >
                <RotateCcw size={12} className="text-slate-500" />
                Limpar
              </button>
            )}

            {ous.length > 0 && (
              <button 
                onClick={selectAll}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 cursor-pointer bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-100/60 transition-colors"
              >
                {filteredOus.length > 0 && filteredOus.every(ou => selectedOus.includes(ou.dn)) ? (
                  <>
                    <CheckSquare size={14} className="text-blue-600"/>
                    Desmarcar
                  </>
                ) : (
                  <>
                    <Square size={14} className="text-blue-600"/>
                    Selecionar Todas
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Lista de OUs */}
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw size={36} className="mx-auto text-blue-600 animate-spin mb-3" />
            <p className="text-slate-600 font-bold text-sm">Conectando ao LDAP e mapeando OUs...</p>
          </div>
        ) : filteredOus.length === 0 ? (
          <div className="p-12 text-center">
            <Server size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium text-sm">
              {ous.length === 0 ? 'Nenhuma OU carregada. Clique em "Buscar OUs" para conectar ao LDAP.' : `Nenhuma OU encontrada para "${searchTerm}".`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredOus.map((ou) => {
              const isSelected = selectedOus.includes(ou.dn);
              const isExpanded = !!expandedOus[ou.dn];
              const isSubOu = ou.is_sub_ou;
              const indentClass = ou.level === 0 ? "pl-4" : ou.level === 1 ? "pl-9 sm:pl-10" : "pl-14 sm:pl-16";

              return (
                <div key={ou.dn} className={`transition-colors ${isSelected ? "bg-blue-50/20" : "hover:bg-slate-50/60"}`}>
                  
                  {/* Linha da OU */}
                  <div className={`p-3 sm:p-4 flex items-center justify-between gap-3 ${indentClass}`}>
                    
                    {/* Checkbox e Detalhes da OU */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => toggleOu(ou.dn)}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          isSelected 
                            ? "bg-blue-600 border-blue-600 text-white shadow-xs" 
                            : "border-slate-300 bg-white hover:border-blue-400"
                        }`}
                      >
                        <Check size={13} className={isSelected ? "opacity-100" : "opacity-0"} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-800 text-sm tracking-tight truncate">
                            {ou.name}
                          </span>

                          {isSubOu ? (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              <Layers size={11} />
                              Sub-OU de {ou.parent_ou_name || "Superior"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                              <Building2 size={11} />
                              OU Principal
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={ou.dn}>
                          {ou.dn}
                        </p>
                      </div>
                    </div>

                    {/* Setor Alvo / Mapeamento de Grupo */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                        <Tag size={13} className="text-slate-400 shrink-0" />
                        <span className="text-[11px] font-bold text-slate-500 shrink-0">Setor:</span>
                        <input
                          type="text"
                          value={ouMappings[ou.dn] || ""}
                          onChange={(e) => handleMappingChange(ou.dn, e.target.value)}
                          placeholder={ou.name}
                          className="bg-transparent font-bold text-xs text-blue-700 outline-none w-28 sm:w-36 focus:text-blue-900"
                          title="Nome do Setor criado/vinculado no sistema para esta OU"
                        />
                      </div>

                      {/* Botão de Expandir Usuários */}
                      <button
                        type="button"
                        onClick={() => toggleExpandOu(ou.dn)}
                        className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                          isExpanded 
                            ? "bg-slate-200 border-slate-300 text-slate-800" 
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                        title="Ver usuários contidos nesta OU"
                      >
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        <span className="hidden md:inline">Colaboradores</span>
                      </button>
                    </div>
                  </div>

                  {/* Detalhe Expandido: Lista de Colaboradores da OU */}
                  {isExpanded && (
                    <div className="bg-slate-50/80 border-t border-b border-slate-100 p-4 pl-8 sm:pl-16 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                          <Users size={14} className="text-blue-600" />
                          Colaboradores encontrados nesta OU:
                        </p>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {ouUsers[ou.dn] ? `${ouUsers[ou.dn].length} encontrado(s)` : "Buscando..."}
                        </span>
                      </div>

                      {loadingOuUsers[ou.dn] ? (
                        <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                          <RefreshCw size={14} className="animate-spin text-blue-600" />
                          Carregando colaboradores do Active Directory...
                        </div>
                      ) : !ouUsers[ou.dn] || ouUsers[ou.dn].length === 0 ? (
                        <p className="py-2 text-xs text-slate-400 italic">
                          Nenhum colaborador com conta ativa encontrado dentro desta OU.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                          {ouUsers[ou.dn].map((user) => (
                            <div 
                              key={user.username}
                              className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">
                                  {user.display_name}
                                </p>
                                <p className="text-[10px] text-slate-500 truncate">
                                  @{user.username} {user.email ? `• ${user.email}` : ""}
                                </p>
                              </div>

                              <div className="shrink-0 flex items-center gap-1.5">
                                {user.imported ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                    <UserCheck size={12} />
                                    Importado
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleImportSingleUser(user, ou.dn)}
                                    disabled={importingUser[user.username]}
                                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold px-2.5 py-1 rounded-md cursor-pointer transition-colors disabled:opacity-50"
                                    title={`Importar apenas ${user.display_name}`}
                                  >
                                    <UserPlus size={12} />
                                    {importingUser[user.username] ? "..." : "Importar"}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
        
        {/* Rodapé de Ações de Importação */}
        {ous.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {selectedOus.length} de {ous.length} OUs selecionadas
              </span>
              {selectedOus.length > 0 && (
                <span className="text-[11px] text-slate-400">
                  (Mapeamento de setores ativo)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleImport(true)}
                disabled={syncing || selectedOus.length === 0}
                className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xs hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                title="Cadastra apenas os Setores das OUs sem importar os usuários"
              >
                <FolderTree size={15} />
                {syncing ? "Processando..." : "Importar Apenas Setores"}
              </button>

              <button
                type="button"
                onClick={() => handleImport(false)}
                disabled={syncing || selectedOus.length === 0}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                title="Sincroniza os setores e todos os colaboradores das OUs selecionadas"
              >
                <DownloadCloud size={16} />
                {syncing ? "Sincronizando..." : "Sincronizar Setores e Colaboradores"}
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
