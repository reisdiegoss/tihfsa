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
  Eye
} from "lucide-react";
import api from "../../api/client";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("ad");

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
  const [userSearch, setUserSearch] = useState("");

  const [errorMsg, setErrorMsg] = useState(null);

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

  const filteredPreviewUsers = ouUsers.filter(u => 
    u.display_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-6xl mx-auto">
      
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("ad")}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "ad"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Server size={18} /> Importação Active Directory
        </button>

        <button
          onClick={() => setActiveTab("zabbix")}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "zabbix"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Activity size={18} /> Integração Zabbix
        </button>

        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "general"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <SettingsIcon size={18} /> Parâmetros Gerais
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

            <button
              onClick={fetchOus}
              disabled={loadingOus || importing}
              className="flex items-center justify-center gap-2 bg-blue-600 text-white px-5 py-3 rounded-2xl text-sm font-bold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              <RefreshCw size={16} className={loadingOus ? "animate-spin" : ""} />
              {loadingOus ? "Carregando..." : "Buscar OUs no AD"}
            </button>
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
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{u.display_name}</p>
                      <p className="text-xs text-slate-400 font-semibold flex items-center gap-2 mt-0.5">
                        <span>@{u.username}</span>
                        {u.email && <span>• {u.email}</span>}
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                      {u.department || "Setor Geral"}
                    </span>
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

    </div>
  );
}
