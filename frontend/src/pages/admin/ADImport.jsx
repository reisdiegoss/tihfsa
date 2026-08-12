import { useState, useEffect } from "react";
import { Users, Server, RefreshCw, CheckSquare, Square, DownloadCloud, AlertCircle } from "lucide-react";
import api from "../../api/client";

export default function ADImport() {
  const [ous, setOus] = useState([]);
  const [selectedOus, setSelectedOus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [report, setReport] = useState(null);

  const fetchOus = async () => {
    setLoading(true);
    setReport(null);
    try {
      const { data } = await api.get("/ad/ous");
      setOus(data);
    } catch (err) {
      console.error(err);
      alert("Erro ao buscar OUs. Verifique a conexão com o LDAP.");
    } finally {
      setLoading(false);
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

  const handleImport = async () => {
    if (selectedOus.length === 0) return;
    
    setSyncing(true);
    setReport(null);
    try {
      const { data } = await api.post("/ad/import", { ous: selectedOus });
      setReport(data.report);
      alert("Importação concluída com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao importar dados do AD.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Server className="text-blue-600" /> Sincronização Active Directory
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            Importe setores e usuários selecionando as Organizational Units (OUs).
          </p>
        </div>
        
        <button
          onClick={fetchOus}
          disabled={loading || syncing}
          className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold shadow-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Buscar OUs
        </button>
      </div>

      {report && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex gap-4 text-emerald-800">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <CheckSquare size={20} className="text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Resumo da Importação</h3>
            <div className="mt-2 text-xs font-semibold flex gap-6">
              <span className="bg-emerald-200/50 px-2.5 py-1 rounded-md text-emerald-900">
                Criados: {report.created}
              </span>
              <span className="bg-blue-100 px-2.5 py-1 rounded-md text-blue-800">
                Atualizados: {report.updated}
              </span>
              <span className="bg-slate-200/60 px-2.5 py-1 rounded-md text-slate-800">
                Desativados: {report.deactivated}
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

      {/* OUs List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Users size={18} className="text-slate-400" />
            Unidades Organizacionais Encontradas
          </h2>
          {ous.length > 0 && (
            <button 
              onClick={selectAll}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              {selectedOus.length === ous.length ? <CheckSquare size={14}/> : <Square size={14}/>}
              Selecionar Todas
            </button>
          )}
        </div>

        {ous.length === 0 ? (
          <div className="p-12 text-center">
            <Server size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium text-sm">Nenhuma OU carregada. Clique em "Buscar OUs" para conectar ao LDAP.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {ous.map((ou) => (
              <div 
                key={ou.dn}
                onClick={() => toggleOu(ou.dn)}
                className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  selectedOus.includes(ou.dn) 
                    ? "bg-blue-600 border-blue-600 text-white" 
                    : "border-slate-300 text-transparent group-hover:border-blue-400"
                }`}>
                  <CheckSquare size={14} className={selectedOus.includes(ou.dn) ? "opacity-100" : "opacity-0"} />
                </div>
                <div>
                  <p className="font-bold text-slate-800">{ou.name}</p>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">{ou.dn}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {ous.length > 0 && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              {selectedOus.length} de {ous.length} OUs selecionadas
            </span>
            <button
              onClick={handleImport}
              disabled={syncing || selectedOus.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <DownloadCloud size={16} />
              {syncing ? "Importando..." : "Importar Selecionadas"}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
