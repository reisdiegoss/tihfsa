import { useState, useEffect } from "react";
import { 
  FileText, Plus, Search, Filter, RefreshCw, 
  CheckCircle2, Clock, RotateCcw, AlertCircle, Eye, 
  UserCheck, ShieldCheck, Camera, Headphones, Radio, 
  Smartphone, Laptop, Key, Package, Building2, ChevronRight, X, Sparkles
} from "lucide-react";
import api from "../../api/client";
import NewTermModal from "../../components/admin/terms/NewTermModal";
import SignTermModal from "../../components/admin/terms/SignTermModal";
import ViewTermModal from "../../components/admin/terms/ViewTermModal";
import TermTemplatesTab from "../../components/admin/terms/TermTemplatesTab";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function Terms() {
  const [terms, setTerms] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending_signature: 0, signed: 0, returned: 0, cancelled: 0 });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Abas Principais ("terms" = Termos Emitidos, "templates" = Modelos de Documentos)
  const [activeMainTab, setActiveMainTab] = useState("terms");

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  // Modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (departmentFilter) params.department_id = departmentFilter;
      if (searchTerm) params.search = searchTerm;

      const [termsRes, statsRes, deptsRes] = await Promise.all([
        api.get("/terms", { params }),
        api.get("/terms/stats"),
        api.get("/departments"),
      ]);

      setTerms(termsRes.data || []);
      setStats(statsRes.data || { total: 0, pending_signature: 0, signed: 0, returned: 0, cancelled: 0 });
      setDepartments(deptsRes.data || []);
    } catch (err) {
      console.error("Erro ao carregar termos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, departmentFilter]);

  // Debounce para busca textual
  useEffect(() => {
    const handler = setTimeout(() => {
      loadData();
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleOpenSign = (term) => {
    setSelectedTerm(term);
    setIsSignModalOpen(true);
  };

  const handleOpenView = (term) => {
    setSelectedTerm(term);
    setIsViewModalOpen(true);
  };

  const handleSaveAndSignNew = (newTerm) => {
    setIsNewModalOpen(false);
    setSelectedTerm(newTerm);
    setIsSignModalOpen(true);
    loadData();
  };

  const getItemIcon = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes("fone")) return <Headphones size={13} className="text-blue-500 shrink-0" />;
    if (lower.includes("rádio") || lower.includes("radio")) return <Radio size={13} className="text-amber-500 shrink-0" />;
    if (lower.includes("celular")) return <Smartphone size={13} className="text-emerald-500 shrink-0" />;
    if (lower.includes("notebook")) return <Laptop size={13} className="text-purple-500 shrink-0" />;
    if (lower.includes("chave")) return <Key size={13} className="text-orange-500 shrink-0" />;
    return <Package size={13} className="text-slate-500 shrink-0" />;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "signed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
            <CheckCircle2 size={12} />
            Assinado & Entregue
          </span>
        );
      case "pending_signature":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
            <Clock size={12} />
            Aguardando Assinatura
          </span>
        );
      case "returned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200">
            <RotateCcw size={12} />
            Devolvido / Baixado
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200">
            Cancelado
          </span>
        );
      default:
        return <span className="text-xs font-bold text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30">
              <FileText size={22} />
            </div>
            Termos de Retirada de Equipamentos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão digital 100% sem papel com assinatura em tela e reconhecimento facial na entrega
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer hover:shadow-none"
        >
          <Plus size={18} />
          Novo Termo de Retirada
        </button>
      </div>

      {/* Sub-Navegação de Abas */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveMainTab("terms")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeMainTab === "terms"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <FileText size={16} />
          Termos Emitidos
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-black ${
            activeMainTab === "terms" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
          }`}>
            {stats.total}
          </span>
        </button>

        <button
          onClick={() => setActiveMainTab("templates")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeMainTab === "templates"
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Sparkles size={16} className={activeMainTab === "templates" ? "text-amber-300" : "text-amber-500"} />
          Modelos de Documentos (Builder Word)
        </button>
      </div>

      {activeMainTab === "templates" ? (
        <TermTemplatesTab />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Termos</p>
            <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-amber-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Aguardando Assinatura</p>
            <p className="text-2xl font-black text-amber-700 mt-0.5">{stats.pending_signature}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-emerald-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Assinados & Ativos</p>
            <p className="text-2xl font-black text-emerald-700 mt-0.5">{stats.signed}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-blue-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <RotateCcw size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Devolvidos / Baixados</p>
            <p className="text-2xl font-black text-blue-700 mt-0.5">{stats.returned}</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={18} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, setor, termo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Filtro Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="pending_signature">⏳ Aguardando Assinatura</option>
            <option value="signed">✓ Assinados & Ativos</option>
            <option value="returned">🔄 Devolvidos / Baixados</option>
            <option value="cancelled">Cancelados</option>
          </select>

          {/* Filtro Setor */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="flex-1 sm:flex-none bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os Setores</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            title="Recarregar"
            className="p-2.5 text-slate-500 hover:text-blue-600 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabela de Termos */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && terms.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-blue-500" />
            <p className="text-sm font-semibold">Carregando termos de responsabilidade...</p>
          </div>
        ) : terms.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <FileText size={48} className="mx-auto mb-3 text-slate-300" />
            <p className="text-base font-bold text-slate-700">Nenhum termo encontrado</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Clique em "Novo Termo de Retirada" para cadastrar a entrega de equipamentos para colaboradores.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
                  <th className="py-4 px-6">Termo</th>
                  <th className="py-4 px-6">Colaborador / Setor</th>
                  <th className="py-4 px-6">Equipamentos Entregues</th>
                  <th className="py-4 px-6">Técnico Emissor</th>
                  <th className="py-4 px-6">Data</th>
                  <th className="py-4 px-6">Biometria</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terms.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* Número do Termo */}
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                        {t.term_number}
                      </span>
                    </td>

                    {/* Beneficiário e Setor */}
                    <td className="py-4 px-6">
                      <div className="min-w-[180px]">
                        <p className="font-bold text-slate-900 leading-tight">{t.beneficiary_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Building2 size={12} className="text-slate-400" />
                            {t.department_name || "Geral"}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            t.has_ad_account 
                              ? "bg-slate-100 text-slate-600" 
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {t.has_ad_account ? "AD" : "Externo"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Itens Entregues */}
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                        {t.items?.slice(0, 3).map((item, i) => (
                          <span 
                            key={i} 
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-medium"
                          >
                            {getItemIcon(item.item_name)}
                            <span className="truncate max-w-[100px]">{item.item_name}</span>
                            {item.quantity > 1 && <strong className="text-blue-600">x{item.quantity}</strong>}
                          </span>
                        ))}
                        {t.items?.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded-md text-[10px] font-bold">
                            +{t.items.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Técnico Emissor */}
                    <td className="py-4 px-6 text-xs text-slate-600 font-medium">
                      {t.technician_name}
                    </td>

                    {/* Data */}
                    <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(t.created_at)}
                    </td>

                    {/* Evidências / Biometria Facial */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      {t.facial_verified ? (
                        <span 
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
                          title="Rosto validado e foto registrada"
                        >
                          <Camera size={12} />
                          Facial OK
                        </span>
                      ) : t.signature_url ? (
                        <span 
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200"
                          title="Apenas assinatura manuscrita"
                        >
                          <UserCheck size={12} />
                          Assinado
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Pendente
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6 whitespace-nowrap">
                      {getStatusBadge(t.status)}
                    </td>

                    {/* Ações */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {t.status === "pending_signature" && (
                          <button
                            onClick={() => handleOpenSign(t)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                            title="Abrir no tablet para o colaborador assinar"
                          >
                            <UserCheck size={14} />
                            Assinar no Tablet
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenView(t)}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Visualizar Termo / Imprimir A4"
                        >
                          <Eye size={18} />
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
      </>
      )}

      {/* MODAIS */}
      <NewTermModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={loadData}
        onSaveAndSign={handleSaveAndSignNew}
      />

      <SignTermModal
        term={selectedTerm}
        isOpen={isSignModalOpen}
        onClose={() => { setIsSignModalOpen(false); setSelectedTerm(null); }}
        onSuccess={loadData}
      />

      <ViewTermModal
        term={selectedTerm}
        isOpen={isViewModalOpen}
        onClose={() => { setIsViewModalOpen(false); setSelectedTerm(null); }}
        onOpenSign={handleOpenSign}
        onSuccess={loadData}
      />

    </div>
  );
}
